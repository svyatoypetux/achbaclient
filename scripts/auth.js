// Authentication functionality
document.addEventListener('DOMContentLoaded', function() {
    
    // Login form handler
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const remember = document.getElementById('remember').checked;
            
            // Basic validation
            if (!email || !password) {
                showMessage('Пожалуйста, заполните все поля', 'error');
                return;
            }
            
            // Show loading state
            const submitBtn = this.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Вход...';
            submitBtn.disabled = true;
            
            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    // Сохранение токена и данных пользователя
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    
                    showMessage(`Добро пожаловать, ${data.user.username}! (UID: ${data.user.uid})`, 'success');
                    
                    // Перенаправление в личный кабинет
                    setTimeout(() => {
                        window.location.href = '/dashboard';
                    }, 1500);
                } else {
                    showMessage(data.error || 'Ошибка входа', 'error');
                }
            } catch (error) {
                console.error('Ошибка входа:', error);
                showMessage('Ошибка подключения к серверу', 'error');
            } finally {
                // Reset button
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });
    }
    
    // Register form handler
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const terms = document.getElementById('terms').checked;
            
            // Validation
            if (!username || !email || !password || !confirmPassword) {
                showMessage('Пожалуйста, заполните все поля', 'error');
                return;
            }
            
            if (password !== confirmPassword) {
                showMessage('Пароли не совпадают', 'error');
                return;
            }
            
            if (password.length < 6) {
                showMessage('Пароль должен содержать минимум 6 символов', 'error');
                return;
            }
            
            if (!terms) {
                showMessage('Необходимо согласиться с пользовательским соглашением', 'error');
                return;
            }
            
            // Show loading state
            const submitBtn = this.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Регистрация...';
            submitBtn.disabled = true;
            
            try {
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, email, password })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    showMessage(`Регистрация успешна! Ваш UID: ${data.uid}. Теперь можете войти в систему.`, 'success');
                    
                    // Clear form
                    this.reset();
                    
                    // Redirect to login page
                    setTimeout(() => {
                        window.location.href = 'login.html';
                    }, 2000);
                } else {
                    showMessage(data.error || 'Ошибка регистрации', 'error');
                }
            } catch (error) {
                console.error('Ошибка регистрации:', error);
                showMessage('Ошибка подключения к серверу', 'error');
            } finally {
                // Reset button
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });
        
        // Real-time password confirmation validation
        const passwordField = document.getElementById('password');
        const confirmPasswordField = document.getElementById('confirmPassword');
        
        if (passwordField && confirmPasswordField) {
            confirmPasswordField.addEventListener('input', function() {
                if (this.value && passwordField.value !== this.value) {
                    this.style.borderColor = '#ff4444';
                } else {
                    this.style.borderColor = '#444';
                }
            });
        }
    }
});

// Show message function
function showMessage(message, type = 'info') {
    // Remove existing messages
    const existingMessage = document.querySelector('.message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // Create message element
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    messageDiv.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        ${message}
    `;
    
    // Add styles
    messageDiv.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        max-width: 400px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        ${type === 'success' ? 'background: linear-gradient(45deg, #00ff88, #00ccff);' : ''}
        ${type === 'error' ? 'background: linear-gradient(45deg, #ff4444, #ff6b6b);' : ''}
        ${type === 'info' ? 'background: linear-gradient(45deg, #4444ff, #6b6bff);' : ''}
    `;
    
    // Add animation keyframes if not already added
    if (!document.querySelector('#messageAnimations')) {
        const style = document.createElement('style');
        style.id = 'messageAnimations';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(messageDiv);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.remove();
                }
            }, 300);
        }
    }, 5000);
}
