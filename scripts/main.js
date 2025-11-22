// Mobile menu toggle
document.addEventListener('DOMContentLoaded', function() {
    checkAuthStatus();
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');

    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function() {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });

        // Close menu when clicking on a link
        document.querySelectorAll('.nav-link').forEach(n => n.addEventListener('click', () => {
            hamburger.classList.remove('active');
            navMenu.classList.remove('active');
        }));
    }

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Add loading animation to buttons
    document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            if (this.type === 'submit') {
                return; // Let form handle submit
            }
            
            this.style.transform = 'scale(0.98)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
        });
    });

    // Add hover effect to feature cards
    document.querySelectorAll('.feature-card').forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px) scale(1.02)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(-5px) scale(1)';
        });
    });
});

// Проверка статуса аутентификации
async function checkAuthStatus() {
    try {
        const response = await fetch('/api/auth/status');
        const data = await response.json();
        
        updateNavigation(data.authenticated, data.user);
    } catch (error) {
        console.log('Не удалось проверить статус аутентификации');
        updateNavigation(false);
    }
}

// Обновление навигации в зависимости от статуса аутентификации
function updateNavigation(isAuthenticated, user = null) {
    const authLink = document.querySelector('a[href="pages/login.html"], a[href="login.html"]');
    
    if (authLink && isAuthenticated && user) {
        // Пользователь авторизован - показываем ссылку на личный кабинет
        authLink.href = '/dashboard';
        authLink.innerHTML = `<i class="fas fa-user"></i> ${user.username}`;
        authLink.title = `UID: ${user.uid}`;
        
        // Добавляем кнопку выхода
        const navMenu = authLink.closest('.nav-menu');
        if (navMenu && !navMenu.querySelector('.logout-link')) {
            const logoutItem = document.createElement('li');
            logoutItem.className = 'nav-item';
            logoutItem.innerHTML = '<a href="#" class="nav-link logout-link"><i class="fas fa-sign-out-alt"></i> Выйти</a>';
            navMenu.appendChild(logoutItem);
            
            // Обработчик выхода
            logoutItem.querySelector('.logout-link').addEventListener('click', async (e) => {
                e.preventDefault();
                await logout();
            });
        }
    } else if (authLink && !isAuthenticated) {
        // Пользователь не авторизован - показываем ссылку на авторизацию
        authLink.href = authLink.href.includes('pages/') ? 'pages/login.html' : 'login.html';
        authLink.innerHTML = 'Авторизация';
        authLink.title = '';
        
        // Удаляем кнопку выхода если есть
        const logoutLink = document.querySelector('.logout-link');
        if (logoutLink) {
            logoutLink.closest('.nav-item').remove();
        }
    }
}

// Функция выхода из системы
async function logout() {
    try {
        const response = await fetch('/api/logout', {
            method: 'POST'
        });
        
        if (response.ok) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.reload();
        }
    } catch (error) {
        console.error('Ошибка выхода:', error);
    }
}
