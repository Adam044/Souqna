document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelector('.nav-links');
    const token = localStorage.getItem('token');

    if (navLinks) {
        navLinks.innerHTML = ''; // Clear existing links
        if (token) {
            navLinks.innerHTML += `
                <a class="nav-link" href="user_dashboard.html">
                    <i class="fas fa-user-circle"></i> حسابي
                </a>`;
        } else {
            navLinks.innerHTML += `
                <a class="nav-link" href="login.html">تسجيل الدخول</a>`;
        }
    }
});