// app/js/dash.js

// Global state for filters, sorting, and pagination
let currentCategoryFilter = 'all';
let currentStatusFilter = 'all';
let currentSearchQuery = '';
let currentSortBy = 'created_at';
let currentSortOrder = -1;
let currentPage = 1;
const PAGE_LIMIT = 15; // Number of items to load per page
let isLoading = false; // Prevents multiple simultaneous loads
let allContentLoaded = false; // Tracks if all content has been loaded

let loadedContentData = []; // Caches data displayed on the page

const API_BASE = 'https://84d36f8f2985.ngrok-free.app/api/v1/admin';

document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    loadContent(true); // Initial load, clears the grid
    populateCategories(); // Populate categories from a dedicated endpoint or initial load
});

function setupEventListeners() {
    // Event listeners for filters
    document.getElementById('category-filter-list').addEventListener('click', (e) => handleFilterEvent(e, 'category'));
    document.getElementById('status-filter-list').addEventListener('click', (e) => handleFilterEvent(e, 'status'));
    document.getElementById('sort-options-list').addEventListener('click', (e) => handleSortEvent(e));
    
    // Search button
    document.getElementById('search-btn').addEventListener('click', handleSearch);
    document.getElementById('search-input').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') handleSearch();
    });

    // Load More button
    document.getElementById('load-more-btn').addEventListener('click', () => {
        currentPage++;
        loadContent(false); // Append new content, don't clear
    });

    // Event delegation for content card actions
    document.getElementById('content-grid').addEventListener('click', async (e) => {
        const target = e.target.closest('.action-btn');
        if (!target) return;

        const contentId = target.dataset.id;
        if (target.classList.contains('edit-btn')) {
            showEditModal(contentId);
        } else if (target.classList.contains('archive-btn')) {
            showConfirmModal('Archive Content?', 'Are you sure you want to archive this content?', () => archiveContent(contentId));
        } else if (target.classList.contains('delete-btn')) {
            showConfirmModal('Delete Content?', 'This action is permanent and cannot be undone!', () => deleteContent(contentId), true);
        } else if (target.classList.contains('view-btn')) {
            showPreviewModal(contentId);
        }
    });

    // Close modals on background click
    document.getElementById('create-modal').addEventListener('click', (e) => e.target === e.currentTarget && hideCreateModal());
    document.getElementById('preview-modal').addEventListener('click', (e) => e.target === e.currentTarget && hidePreviewModal());
    document.getElementById('confirm-modal').addEventListener('click', (e) => e.target === e.currentTarget && hideConfirmModal());
}

// Generic handler for filter clicks
function handleFilterEvent(e, filterType) {
    const target = e.target.closest('button.filter-btn');
    if (target) {
        document.querySelectorAll(`.filter-btn[data-filter-type="${filterType}"]`).forEach(b => b.classList.remove('active'));
        target.classList.add('active');
        if (filterType === 'category') currentCategoryFilter = target.dataset.filterValue;
        if (filterType === 'status') currentStatusFilter = target.dataset.filterValue;
        
        resetAndLoad();
    }
}

// Generic handler for sort clicks
function handleSortEvent(e) {
    const target = e.target.closest('button.filter-btn');
    if (target) {
        document.querySelectorAll('#sort-options-list .filter-btn').forEach(b => b.classList.remove('active'));
        target.classList.add('active');
        currentSortBy = target.dataset.sortBy;
        currentSortOrder = parseInt(target.dataset.sortOrder);

        resetAndLoad();
    }
}

// Handler for search
function handleSearch() {
    currentSearchQuery = document.getElementById('search-input').value;
    resetAndLoad();
}

// Resets pagination and content grid before loading new filtered/sorted data
function resetAndLoad() {
    currentPage = 1;
    allContentLoaded = false;
    document.getElementById('content-grid').innerHTML = '';
    loadedContentData = [];
    loadContent(true);
}

async function loadContent(isNewQuery = false) {
    if (isLoading || allContentLoaded) return;
    isLoading = true;

    const loadMoreBtn = document.getElementById('load-more-btn');
    loadMoreBtn.textContent = 'Loading...';
    loadMoreBtn.style.display = 'block';

    try {
        const params = new URLSearchParams({
            skip: (currentPage - 1) * PAGE_LIMIT,
            limit: PAGE_LIMIT,
            sort_by: currentSortBy,
            sort_order: currentSortOrder.toString()
        });

        if (currentCategoryFilter !== 'all') params.append('category', currentCategoryFilter);
        if (currentStatusFilter !== 'all') params.append('statuses', currentStatusFilter);

        const response = await fetch(`${API_BASE}/contents/?${params.toString()}`, {
            headers: {
                'ngrok-skip-browser-warning': 'true',
                'Content-Type': 'application/json'
                // أضف 'Authorization': 'Token YOUR_TOKEN' إذا لزم الأمر
            }
        });

        if (!response.ok) {
            const text = await response.text();
            console.error('Response text:', text);
            throw new Error(`Failed to load content: ${response.statusText}`);
        }
        
        const newContent = await response.json();
        
        if (isNewQuery) {
            document.getElementById('content-grid').innerHTML = '';
            loadedContentData = [];
        }

        loadedContentData.push(...newContent);

        if (newContent.length === 0 && currentPage === 1) {
            showEmptyState("No content found with the current filters.");
        } else {
            document.getElementById('empty-state').style.display = 'none';
        }
        
        displayContent(newContent, isNewQuery);

        if (newContent.length < PAGE_LIMIT) {
            allContentLoaded = true;
            loadMoreBtn.style.display = 'none';
        } else {
            loadMoreBtn.style.display = 'block';
            loadMoreBtn.textContent = 'Load More';
        }
    } catch (error) {
        console.error('Error loading content:', error);
        showEmptyState(`Could not load content: ${error.message}`);
    } finally {
        isLoading = false;
    }
}

async function populateCategories() {
    try {
        const statsResponse = await fetch(`${API_BASE}/contents/actions/stats`, {
            headers: {
                'ngrok-skip-browser-warning': 'true',
                'Content-Type': 'application/json'
                // أضف 'Authorization': 'Token YOUR_TOKEN' إذا لزم الأمر
            }
        });

        if (!statsResponse.ok) {
            const text = await statsResponse.text();
            console.error('Stats response text:', text);
            return;
        }

        const stats = await statsResponse.json();
        const categories = Object.keys(stats.by_category).sort();
        
        const filterList = document.getElementById('category-filter-list');
        filterList.innerHTML = `<button class="filter-btn ${currentCategoryFilter === 'all' ? 'active' : ''}" data-filter-type="category" data-filter-value="all">All Categories</button>`; 
        
        categories.forEach(category => {
            const btn = document.createElement('button');
            btn.className = `filter-btn ${currentCategoryFilter === category ? 'active' : ''}`;
            btn.dataset.filterType = 'category';
            btn.dataset.filterValue = category;
            btn.textContent = category.replace(/_/g, ' ');
            filterList.appendChild(btn);
        });
    } catch (error) {
        console.error("Could not populate categories:", error);
    }
}

// Displays content cards in the grid
function displayContent(content, clearFirst) {
    const grid = document.getElementById('content-grid');
    if (clearFirst) grid.innerHTML = '';

    content.forEach(item => {
        const card = document.createElement('div');
        card.className = 'content-card';
        // CORRECTED: Use item._id instead of item.id
        card.innerHTML = `
            ${item.image_url ? `<img class="blog-image" src="${item.image_url}" alt="${item.title || 'Content Image'}">` : `<div class="blog-image" style="background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);"></div>`}
            <div class="content-meta">
                <span class="content-category">${item.category.replace(/_/g, ' ')}</span>
                <span class="content-status status-${item.status}">${item.status.replace(/_/g, ' ')}</span>
            </div>
            <h3 class="content-title">${item.title || 'AI Generated (No Title Yet)'}</h3>
            <p class="content-preview">${getPreviewText(item.content)}</p>
            <div class="content-actions">
                <button class="action-btn view-btn" data-id="${item._id}">View</button>
                <button class="action-btn edit-btn" data-id="${item._id}">Edit</button>
                ${item.status !== 'archived' ? `<button class="action-btn archive-btn" data-id="${item._id}">Archive</button>` : `<button class="action-btn archive-btn" data-id="${item._id}" disabled>Archived</button>`}
                <button class="action-btn delete-btn" data-id="${item._id}">Delete</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

// --- Helper & Modal Functions ---

function getPreviewText(content) {
    if (!content) return 'No content preview available.';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    const strippedText = tempDiv.textContent || tempDiv.innerText || '';
    return strippedText.substring(0, 120) + (strippedText.length > 120 ? '...' : '');
}

function showEmptyState(message) {
    document.getElementById('content-grid').style.display = 'none';
    document.getElementById('load-more-btn').style.display = 'none';
    const emptyState = document.getElementById('empty-state');
    emptyState.style.display = 'block';
    emptyState.querySelector('p').textContent = message;
}

// Generic Confirmation Modal
function showConfirmModal(title, text, onConfirm, isDestructive = false) {
    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-text').textContent = text;
    const confirmBtn = document.getElementById('confirm-modal-btn');
    confirmBtn.onclick = () => {
        onConfirm();
        hideConfirmModal();
    };
    confirmBtn.style.backgroundColor = isDestructive ? '#dc3545' : '#007bff';
    document.getElementById('confirm-modal').classList.add('active');
}

function hideConfirmModal() {
    document.getElementById('confirm-modal').classList.remove('active');
}

// Create/Edit Modals
function showCreateModal() {
    resetForm();
    document.getElementById('modal-title').textContent = 'Create New Content';
    document.getElementById('submit-btn').textContent = 'Create Content';
    document.getElementById('create-modal').classList.add('active');
}

function hideCreateModal() {
    document.getElementById('create-modal').classList.remove('active');
}

async function showEditModal(contentId) {
    // Find content in cache first
    let content = loadedContentData.find(item => item._id === contentId);
    
    if (!content) { // If not found, fetch it directly
        try {
            const response = await fetch(`${API_BASE}/contents/${contentId}`);
            if (!response.ok) throw new Error('Content not found for editing.');
            content = await response.json();
        } catch (error) {
            alert(error.message);
            return;
        }
    }
    
    resetForm();
    document.getElementById('modal-title').textContent = 'Edit Content';
    document.getElementById('submit-btn').textContent = 'Save Changes';
    
    document.getElementById('generation-method').parentElement.style.display = 'none';
    document.getElementById('ai-fields').style.display = 'none';
    document.getElementById('manual-fields').style.display = 'block';
    document.getElementById('author-field').style.display = 'block';
    document.getElementById('title-field').style.display = 'block';

    document.getElementById('content-id').value = content._id; // CORRECTED
    document.getElementById('author-name').value = content.created_by || '';
    document.getElementById('content-category').value = content.category || '';
    document.getElementById('content-type').value = content.content_type || 'article';
    document.getElementById('content-title').value = content.title || '';
    document.getElementById('manual-content').value = content.content || '';
    document.getElementById('content-keywords').value = (content.keywords || []).join(', ');
    document.getElementById('content-status').value = content.status;
    document.getElementById('course-url').value = content.course_url || '';
    document.getElementById('image-url').value = content.image_url || '';

    document.getElementById('create-modal').classList.add('active');
}

function showPreviewModal(contentId) {
    const content = loadedContentData.find(item => item._id === contentId);
    if (!content) {
        alert("Content not found for preview.");
        return;
    }
    // ... rest of the function is okay, no changes needed to its logic
    const iframe = document.getElementById('preview-iframe');
    const modal = document.getElementById('preview-modal');
    document.getElementById('preview-modal-title').textContent = content.title || 'Article Preview';

    iframe.srcdoc = `
        <!DOCTYPE html><html><head><title>Preview</title>
        <link rel="stylesheet" href="css/article.css">
        <style>
            body { background: #fff; padding: 2rem; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            .header, .nav-bar, .related-blogs, .breadcrumb { display: none; }
            .container { transform: none; box-shadow: none; padding: 0; max-width: 800px; margin: 0 auto;}
            .article-header { text-align: left; } .article-title { font-size: 1.8rem; }
            .article-meta { margin-bottom: 1rem; } .category { margin-top: 1rem; }
            .hero-image { display: none; }
            .article-main-image { width: 100%; height: auto; max-height: 400px; object-fit: cover; border-radius: 8px; margin-bottom: 2rem; }
        </style>
        </head><body>
            <main class="container">
                 <header class="article-header">
                    <div class="category">${content.category.replace(/_/g, ' ')}</div>
                    <h1 class="article-title">${content.title || ''}</h1>
                    <div class="article-meta">By ${content.created_by || 'Unknown'} • 
                        ${new Date(content.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                        ${content.word_count ? ` • ${Math.ceil(content.word_count / 200)} min read` : ''}
                    </div>
                </header>
                ${content.image_url ? `<img src="${content.image_url}" alt="${content.title || 'Article Image'}" class="article-main-image">` : ''}
                <div class="article-content">${content.content || ''}</div>
            </main>
        </body></html>`;
    
    modal.classList.add('active');
}

function hidePreviewModal() {
    document.getElementById('preview-modal').classList.remove('active');
    document.getElementById('preview-iframe').srcdoc = 'about:blank';
}

function toggleGenerationFields() {
    const method = document.getElementById('generation-method').value;
    const isManual = method === 'manual';
    
    document.getElementById('ai-fields').style.display = isManual ? 'none' : 'block';
    document.getElementById('manual-fields').style.display = isManual ? 'block' : 'none';
    document.getElementById('author-field').style.display = isManual ? 'block' : 'none';
    document.getElementById('content-title').required = isManual;
    document.getElementById('manual-content').required = isManual;
    document.getElementById('content-keywords').required = !isManual;
    document.getElementById('target-length').required = !isManual;
    
    if (!isManual) {
        document.getElementById('author-name').value = 'AI System';
        document.getElementById('author-name').readOnly = true;
    } else {
        document.getElementById('author-name').readOnly = false;
    }
}

function resetForm() {
    document.querySelector('#create-modal form').reset();
    document.getElementById('content-id').value = '';
    document.getElementById('generation-method').parentElement.style.display = 'block';
    toggleGenerationFields();
    document.getElementById('content-status').value = 'draft';
}


// --- API & Form Submission Logic ---

async function handleFormSubmit() {
    const contentId = document.getElementById('content-id').value;
    if (contentId) {
        await updateContent(contentId);
    } else {
        await createContent();
    }
}

async function createContent() {
    // ... This function logic is mostly OK, no major changes needed
    const submitBtn = document.getElementById('submit-btn');
    const method = document.getElementById('generation-method').value;
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating...';

    const courseUrl = document.getElementById('course-url').value;
    const imageUrl = document.getElementById('image-url').value;
    
    let endpoint, payload;

    if (method === 'ai') {
        endpoint = `${API_BASE}/contents/ai`;
        payload = {
            category: document.getElementById('content-category').value,
            keywords: document.getElementById('content-keywords').value.split(',').map(k => k.trim()).filter(Boolean),
            guidance: document.getElementById('content-guidance').value || null,
            content_type: document.getElementById('content-type').value,
            target_length: parseInt(document.getElementById('target-length').value),
            course_url: courseUrl || null,
            image_url: imageUrl || null,
        };
    } else { // Manual
        endpoint = `${API_BASE}/contents/manual`;
        payload = {
            created_by: document.getElementById('author-name').value,
            category: document.getElementById('content-category').value,
            title: document.getElementById('content-title').value,
            content: document.getElementById('manual-content').value,
            keywords: document.getElementById('content-keywords').value.split(',').map(k => k.trim()).filter(Boolean),
            content_type: document.getElementById('content-type').value,
            status: document.getElementById('content-status').value,
            course_url: courseUrl || null,
            image_url: imageUrl || null
        };
    }

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Unknown error during content creation.');
        }
        
        hideCreateModal();
        resetAndLoad();
    } catch (error) {
        alert(`Error creating content: ${error.message}`);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Content';
    }
}

async function updateContent(contentId) {
    // ... This function logic is mostly OK
    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    const payload = {
        created_by: document.getElementById('author-name').value,
        category: document.getElementById('content-category').value,
        title: document.getElementById('content-title').value,
        content: document.getElementById('manual-content').value,
        keywords: document.getElementById('content-keywords').value.split(',').map(k => k.trim()).filter(Boolean),
        status: document.getElementById('content-status').value,
        content_type: document.getElementById('content-type').value,
        course_url: document.getElementById('course-url').value || null,
        image_url: document.getElementById('image-url').value || null
    };

    try {
        const response = await fetch(`${API_BASE}/contents/${contentId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error((await response.json()).detail || 'Failed to update content.');
        hideCreateModal();
        resetAndLoad();
    } catch (error) {
        alert(`Error updating content: ${error.message}`);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Changes';
    }
}

async function archiveContent(contentId) {
    try {
        const response = await fetch(`${API_BASE}/contents/actions/archive/${contentId}`, { method: 'PATCH' });
        if (!response.ok) throw new Error((await response.json()).detail);
        alert('Content archived successfully!');
        resetAndLoad();
    } catch (error) {
        alert(`Error archiving content: ${error.message}`);
    }
}

async function deleteContent(contentId) {
    try {
        const response = await fetch(`${API_BASE}/contents/${contentId}`, { method: 'DELETE' });
        if (response.status !== 204) throw new Error((await response.json()).detail);
        alert('Content permanently deleted!');
        resetAndLoad();
    } catch (error) {
        alert(`Error deleting content: ${error.message}`);
    }
}
