// Mobile menu toggle
document.querySelector('.mobile-menu-btn')?.addEventListener('click', function() {
    document.querySelector('.mobile-menu').classList.toggle('show');
});

// Close mobile menu when clicking outside
document.addEventListener('click', function(e) {
    if (!e.target.closest('.mobile-menu') && !e.target.closest('.mobile-menu-btn')) {
        document.querySelector('.mobile-menu').classList.remove('show');
    }
});

// Load products from database
async function loadProducts(filters = {}) {
    try {
        // Build query string from filters
        const queryParams = new URLSearchParams();
        for (const key in filters) {
            if (filters[key]) {
                queryParams.append(key, filters[key]);
            }
        }

        const response = await fetch(`/api/products?${queryParams.toString()}`);
        const products = await response.json();
        
        const container = document.getElementById('all-products');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (products.length === 0) {
            container.innerHTML = '<p class="no-products">لا توجد منتجات متاحة حالياً</p>';
            return;
        }
        
        products.forEach(product => {
            const productCard = document.createElement('div');
            productCard.className = 'modern-product-card';
            productCard.innerHTML = `
                <div class="product-badge">${product.category}</div>
                <div class="product-image">
                    <img src="${product.images[0]}" alt="${product.title}" loading="lazy">
                    <div class="product-overlay">
                        <a href="product.html?id=${product.id}" class="btn quick-view">عرض سريع</a>
                    </div>
                </div>
                <div class="product-details">
                    <h3 class="product-title">${product.title}</h3>
                    <div class="product-meta">
                        <span class="price">${product.price} ₪</span>
                        <span class="location"><i class="fas fa-map-marker-alt"></i> ${product.seller_location}</span>
                    </div>
                    <a href="product.html?id=${product.id}" class="btn primary-btn">عرض التفاصيل</a>
                </div>
            `;
            container.appendChild(productCard);
        });
    } catch (error) {
        console.error('Error loading products:', error);
        const container = document.getElementById('all-products');
        if (container) {
            container.innerHTML = '<p class="error-message">حدث خطأ أثناء جلب المنتجات. يرجى المحاولة لاحقاً.</p>';
        }
    }
}

// Apply filters
function setupFilters() {
    const applyBtn = document.getElementById('applyFilters');
    if (!applyBtn) return;
    
    applyBtn.addEventListener('click', function() {
        const filters = {
            category: document.getElementById('category').value,
            location: document.getElementById('location').value,
            minPrice: document.getElementById('minPrice').value,
            maxPrice: document.getElementById('maxPrice').value
        };
        
        loadProducts(filters);
        document.getElementById('filterSidebar').classList.remove('active');
    });
}


// Register form handling
document.getElementById('registerForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    const errorElement = document.getElementById('registerError');
    errorElement.textContent = '';
    
    if (password !== confirmPassword) {
        errorElement.textContent = 'كلمة المرور وتأكيدها غير متطابقين';
        return;
    }
    
    try {
        // In a real app, this would POST to your API
        // const response = await fetch('/api/register', {
        //     method: 'POST',
        //     headers: {
        //         'Content-Type': 'application/json'
        //     },
        //     body: JSON.stringify({ name, email, phone, password })
        // });
        
        // const data = await response.json();
        
        // Mock success response
        console.log('Registration submitted:', { name, email, phone, password });
        alert('تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول.');
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Registration error:', error);
        errorElement.textContent = 'حدث خطأ أثناء إنشاء الحساب. يرجى المحاولة مرة أخرى.';
    }
});

// Login form handling
document.getElementById('loginForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    const errorElement = document.getElementById('loginError');
    errorElement.textContent = '';
    
    try {
        // In a real app, this would POST to your API
        // const response = await fetch('/api/login', {
        //     method: 'POST',
        //     headers: {
        //         'Content-Type': 'application/json'
        //     },
        //     body: JSON.stringify({ email, password })
        // });
        
        // const data = await response.json();
        
        // Mock success response
        console.log('Login submitted:', { email, password });
        alert('تم تسجيل الدخول بنجاح!');
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Login error:', error);
        errorElement.textContent = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
    }
});

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    loadFeaturedProducts();
});