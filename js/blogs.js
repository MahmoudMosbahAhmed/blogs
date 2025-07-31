// app/js/blogs.js
document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'http://localhost:8000/api/v1/public';
    
    let currentCategory = 'all';
    let currentContentType = 'all';
    let currentPage = 1;
    const PAGE_LIMIT = 12;
    let isLoading = false;
    let allPostsLoaded = false;

    const blogGrid = document.getElementById('blogGrid');
    const navMenuLinks = document.getElementById('navMenuLinks');
    const filterTabsContainer = document.getElementById('filterTabsContainer');
    const loadMoreBtn = document.querySelector('.load-more-btn');

    // Initial setup
    initializePage();

    function setupEventListeners() {
        loadMoreBtn.addEventListener('click', () => {
            if (!isLoading) {
                currentPage++;
                fetchPosts(false); // Append posts, don't clear grid
            }
        });
    }

    async function initializePage() {
        // Get category from URL if present
        const urlParams = new URLSearchParams(window.location.search);
        const categoryFromUrl = urlParams.get('category');
        if (categoryFromUrl) {
            currentCategory = categoryFromUrl;
        }

        await populateFilters(); // Populate nav and filter tabs first
        setupEventListeners();
        fetchPosts(true); // Initial fetch, clears the grid
    }

    async function fetchPosts(isNewQuery = false) {
        if (isLoading || allPostsLoaded) return;
        isLoading = true;
        loadMoreBtn.textContent = 'Loading...';
        loadMoreBtn.style.display = 'block';

        if (isNewQuery) {
            currentPage = 1;
            allPostsLoaded = false;
            blogGrid.innerHTML = '';
        }

        try {
            const params = new URLSearchParams({
                skip: (currentPage - 1) * PAGE_LIMIT,
                limit: PAGE_LIMIT,
                sort_by: 'created_at',
                sort_order: -1
            });

            if (currentCategory !== 'all') params.append('category', currentCategory);
            if (currentContentType !== 'all') params.append('content_type', currentContentType);
            
            const response = await fetch(`${API_BASE_URL}/contents/?${params.toString()}`);
            if (!response.ok) throw new Error(`Failed to fetch content: ${await response.text()}`);

            const posts = await response.json();

            if (posts.length === 0 && currentPage === 1) {
                blogGrid.innerHTML = '<p>No articles found matching your filters.</p>';
                loadMoreBtn.style.display = 'none';
            } else {
                displayPosts(posts);
            }

            if (posts.length < PAGE_LIMIT) {
                allPostsLoaded = true;
                loadMoreBtn.style.display = 'none';
            } else {
                loadMoreBtn.style.display = 'block';
                loadMoreBtn.textContent = 'Load More Posts';
            }

        } catch (error) {
            console.error('Fetching posts failed:', error);
            blogGrid.innerHTML = '<p style="color: red;">Failed to load content. Please try again later.</p>';
        } finally {
            isLoading = false;
        }
    }

    async function populateFilters() {
        // Compromise: fetch a larger list once to get categories and types, as there's no dedicated endpoint.
        // Ideal solution: A dedicated API endpoint like GET /api/v1/public/stats
        try {
            const response = await fetch(`${API_BASE_URL}/contents/?limit=100`);
            if (!response.ok) throw new Error('Failed to fetch filter data');
            const allPosts = await response.json();

            const categories = [...new Set(allPosts.map(post => post.category))].sort();
            const contentTypes = [...new Set(allPosts.map(post => post.content_type))].sort();

            navMenuLinks.innerHTML = '';
            filterTabsContainer.innerHTML = '';
            
            // Populate Categories in Nav
            addCategoryFilter('all', currentCategory === 'all');
            categories.forEach(category => addCategoryFilter(category, currentCategory === category));
            
            // Populate Content Types as Tabs
            addFilterTab('all', currentContentType === 'all', 'content-type', 'All Types');
            contentTypes.forEach(type => addFilterTab(type, false, 'content-type', type.replace(/_/g, ' ')));

        } catch (error) {
            console.error("Failed to populate filters:", error);
        }
    }

    function addCategoryFilter(category, isActive = false) {
        const categoryName = category.replace(/_/g, ' ');
        const navItem = document.createElement('li');
        const link = document.createElement('a');
        link.href = '#';
        link.className = `filter-link ${isActive ? 'active' : ''}`;
        link.dataset.filterType = 'category';
        link.dataset.filterValue = category;
        link.textContent = categoryName;

        link.addEventListener('click', (e) => {
            e.preventDefault();
            handleFilterClick('category', category);
        });
        
        navItem.appendChild(link);
        navMenuLinks.appendChild(navItem);
    }
    
    function addFilterTab(value, isActive = false, type, displayText) {
        const tabItem = document.createElement('div');
        tabItem.className = `filter-tab ${isActive ? 'active' : ''}`;
        tabItem.dataset.filterType = type;
        tabItem.dataset.filterValue = value;
        tabItem.textContent = displayText;

        tabItem.addEventListener('click', () => handleFilterClick(type, value));
        filterTabsContainer.appendChild(tabItem);
    }

    function handleFilterClick(filterType, filterValue) {
        if (filterType === 'category') {
            currentCategory = filterValue;
            document.querySelectorAll('.filter-link[data-filter-type="category"]').forEach(el => {
                el.classList.toggle('active', el.dataset.filterValue === currentCategory);
            });
        } else if (filterType === 'content-type') {
            currentContentType = filterValue;
            document.querySelectorAll('.filter-tab[data-filter-type="content-type"]').forEach(el => {
                el.classList.toggle('active', el.dataset.filterValue === currentContentType);
            });
        }
        
        fetchPosts(true); // Trigger a new query, clearing the grid
    }
    
    function displayPosts(postsToDisplay) {
        postsToDisplay.forEach(post => {
            blogGrid.appendChild(createBlogCard(post));
        });
    }

    function createBlogCard(post) {
        const card = document.createElement('article');
        card.className = 'blog-card';
        // CORRECTED: Use post._id instead of post.id
        card.onclick = () => window.location.href = `article.html?id=${post._id}`;

        const postDate = new Date(post.created_at).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        });

        card.innerHTML = `
            ${post.image_url ? `<img class="blog-image" src="${post.image_url}" alt="${post.title || 'Blog Image'}">` : `<div class="blog-image" style="background-color: #e0e0e0;"></div>`}
            <div class="blog-content">
                <div class="blog-tag">${post.category.replace(/_/g, ' ')}</div>
                <h3 class="blog-title">${post.title}</h3>
                <div class="blog-meta">By ${post.created_by} • ${postDate}</div>
            </div>
        `;
        return card;
    }
});