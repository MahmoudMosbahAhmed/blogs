// app/js/article.js
document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'https://84d36f8f2985.ngrok-free.app/api/v1/public';
    const contentId = new URLSearchParams(window.location.search).get('id');
    const navMenuLinks = document.getElementById('navMenuLinks');
    const articleHeroImage = document.getElementById('articleHeroImage');

    async function fetchBlogPost(id) {
        if (!id) {
            document.getElementById('articleTitle').textContent = "Error: No article ID provided.";
            document.getElementById('articleContent').innerHTML = "<p>Please provide a valid article ID.</p>";
            articleHeroImage.style.display = 'none';
            return;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/contents/${id}`);
            if (!response.ok) {
                throw new Error(`Article failed to load: ${response.status} ${response.statusText}`);
            }

            // Check Content-Type
            const contentType = response.headers.get('Content-Type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                throw new Error(`Expected JSON, received ${contentType}: ${text.slice(0, 100)}...`);
            }

            const data = await response.json();
            
            document.title = data.title;
            document.getElementById('articleCategory').textContent = data.category.replace(/_/g, ' ');
            document.getElementById('articleTitle').textContent = data.title;
            document.getElementById('breadcrumb-title').textContent = data.title;
            const postDate = new Date(data.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            document.getElementById('articleMeta').textContent = `By ${data.created_by} • ${postDate}`;
            document.getElementById('articleContent').innerHTML = data.content; // Consider using DOMPurify for user-generated content
            
            if (data.image_url) {
                articleHeroImage.src = data.image_url;
                articleHeroImage.style.display = 'block';
            } else {
                articleHeroImage.style.display = 'none';
            }

            const wordsPerMinute = 200;
            const wordCount = data.word_count || (data.content ? data.content.split(/\s+/).length : 0);
            const readTimeMinutes = Math.ceil(wordCount / wordsPerMinute);
            document.getElementById('readTime').textContent = ` • ${readTimeMinutes} min read`;

            fetchRelatedBlogs(id);

        } catch (error) {
            console.error('Error fetching blog post:', error);
            document.getElementById('articleTitle').textContent = `Error: ${error.message}`;
            document.getElementById('articleContent').innerHTML = `<p>${error.message}</p>`;
            articleHeroImage.style.display = 'none';
        }
    }

    async function fetchRelatedBlogs(currentId) {
        const relatedBlogsSection = document.querySelector('.related-blogs');
        const relatedGrid = document.getElementById('relatedBlogsGrid');
        
        try {
            const response = await fetch(`${API_BASE_URL}/contents/${currentId}/related`);
            if (!response.ok) {
                throw new Error(`Could not fetch related blogs: ${response.status} ${response.statusText}`);
            }

            // Check Content-Type
            const contentType = response.headers.get('Content-Type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                throw new Error(`Expected JSON, received ${contentType}: ${text.slice(0, 100)}...`);
            }

            const relatedData = await response.json();
            
            if (relatedData && relatedData.length > 0) {
                relatedBlogsSection.style.display = 'block';
                displayRelatedBlogs(relatedData);
            } else {
                relatedBlogsSection.style.display = 'none';
            }
        } catch (error) {
            console.error('Error fetching related blogs:', error);
            relatedBlogsSection.style.display = 'none';
        }
    }

    function displayRelatedBlogs(blogs) {
        const relatedGrid = document.getElementById('relatedBlogsGrid');
        relatedGrid.innerHTML = '';

        blogs.forEach((post) => {
            const card = document.createElement('article');
            card.className = 'blog-card';
            card.onclick = () => window.location.href = `article.html?id=${post._id}`;
            
            const postDate = new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            card.innerHTML = `
                ${post.image_url ? `<img class="blog-image" src="${post.image_url}" alt="${post.title || 'Related Blog Image'}">` : `<div class="blog-image" style="background-color: #f0f0f0;"></div>`}
                <div class="blog-content">
                    <h3 class="blog-title">${post.title}</h3>
                    <div class="blog-meta">By ${post.created_by} • ${postDate}</div>
                </div>
            `;
            relatedGrid.appendChild(card);
        });
    }
    
    async function initializeNavMenu() {
        try {
            const response = await fetch(`${API_BASE_URL}/contents/?limit=100`);
            if (!response.ok) {
                throw new Error(`Failed to initialize navigation menu: ${response.status} ${response.statusText}`);
            }

            // Check Content-Type
            const contentType = response.headers.get('Content-Type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                throw new Error(`Expected JSON, received ${contentType}: ${text.slice(0, 100)}...`);
            }

            const posts = await response.json();
            if (!Array.isArray(posts)) throw new TypeError("API response is not an array.");

            const categories = [...new Set(posts.map(post => post.category))].sort();
            
            navMenuLinks.innerHTML = `<li><a href="blogs.html" class="nav-link">All</a></li>`;
            
            categories.forEach(category => {
                const navItem = document.createElement('li');
                navItem.innerHTML = `<a href="blogs.html?category=${category}" class="nav-link">${category.replace(/_/g, ' ')}</a>`;
                navMenuLinks.appendChild(navItem);
            });
        } catch (error) {
            console.error("Failed to initialize navigation menu:", error);
            if (navMenuLinks) navMenuLinks.innerHTML = `<li><span style="color: red;">Error loading menu.</span></li>`;
        }
    }

    // Run initialization
    fetchBlogPost(contentId);
    initializeNavMenu();
});
