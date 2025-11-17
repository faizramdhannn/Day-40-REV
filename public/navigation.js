// navigation.js - Add this script to all HTML pages

// Function to update navigation based on login status
function updateNavigation() {
    const user = sessionStorage.getItem('user');
    const loginLink = document.getElementById('login-link');
    const userGreeting = document.getElementById('user-greeting');
    const userName = document.getElementById('user-name');
    const logoutBtn = document.getElementById('logout-btn-container');
    
    if (user) {
        const userData = JSON.parse(user);
        const displayName = userData.nick_name || userData.full_name || 'User';
        
        if (loginLink) loginLink.style.display = 'none';
        if (userGreeting) userGreeting.style.display = 'block';
        if (userName) userName.textContent = displayName;
        if (logoutBtn) logoutBtn.style.display = 'block';
    } else {
        if (loginLink) loginLink.style.display = 'block';
        if (userGreeting) userGreeting.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'none';
    }
}

function handleLogout() {
    sessionStorage.removeItem('user');
    alert('✅ Logged out successfully');
    window.location.href = '/';
}

// Update navigation on page load
window.addEventListener('load', () => {
    updateNavigation();
});