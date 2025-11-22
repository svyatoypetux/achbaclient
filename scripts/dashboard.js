// Dashboard functionality
document.addEventListener('DOMContentLoaded', function() {
    checkAuthentication();
    loadUserProfile();
    initializeEventListeners();
});

// Проверка аутентификации
async function checkAuthentication() {
    try {
        const response = await fetch('/api/auth/status');
        const data = await response.json();
        
        if (!data.authenticated) {
            window.location.href = '/pages/login.html';
            return;
        }
        
        // Пользователь аутентифицирован, можно загружать данные
        console.log('Пользователь аутентифицирован:', data.user);
    } catch (error) {
        console.error('Ошибка проверки аутентификации:', error);
        showNotification('Ошибка подключения к серверу', 'error');
        setTimeout(() => {
            window.location.href = '/pages/login.html';
        }, 2000);
    }
}

// Загрузка профиля пользователя
async function loadUserProfile() {
    try {
        showLoading();
        
        const response = await fetch('/api/user/profile', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Ошибка загрузки профиля');
        }
        
        const data = await response.json();
        const user = data.user;
        
        // Обновление UI с данными пользователя
        updateUserInterface(user);
        hideLoading();
        
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
        showNotification('Ошибка загрузки данных профиля', 'error');
        hideLoading();
    }
}

// Обновление интерфейса с данными пользователя
function updateUserInterface(user) {
    // Основная информация
    document.getElementById('userLogin').textContent = user.username;
    document.getElementById('userEmail').textContent = user.email;
    document.getElementById('userRole').textContent = getRoleDisplayName(user.role);
    document.getElementById('userUID').textContent = `#${user.uid}`;
    
    // Дата регистрации
    const registrationDate = new Date(user.created_at);
    document.getElementById('userRegistered').textContent = formatDate(registrationDate);
    
    // Подписка
    const subscriptionText = getSubscriptionDisplayName(user.subscription_type, user.subscription_expires);
    document.getElementById('userSubscription').textContent = subscriptionText;
    
    // Последний вход
    if (user.last_login) {
        const lastLoginDate = new Date(user.last_login);
        document.getElementById('lastLogin').textContent = formatDate(lastLoginDate);
    } else {
        document.getElementById('lastLogin').textContent = 'Первый вход';
    }
    
    
    // Показать админ панель для администраторов
    if (user.role === 'admin') {
        const adminBtn = document.getElementById('adminPanelBtn');
        if (adminBtn) {
            adminBtn.style.display = 'flex';
            console.log('🔑 Админ панель активирована для:', user.username);
        }
    }
    
    // Показать панель загрузок только для пользователей с подпиской
    updateDownloadsPanel(user);
}

// Получение отображаемого имени роли
function getRoleDisplayName(role) {
    const roles = {
        'user': 'Пользователь',
        'premium': 'Премиум',
        'admin': 'Администратор',
        'moderator': 'Модератор',
        'support': 'Саппорт',
        'media': 'Медиа',
        'moder': 'Модератор'
    };
    return roles[role] || 'Пользователь';
}

// Получение отображаемого имени подписки
function getSubscriptionDisplayName(type, expires) {
    if (type === 'lifetime') {
        return 'Бессрочно';
    }
    
    if (expires) {
        const expiryDate = new Date(expires);
        const now = new Date();
        
        if (expiryDate > now) {
            return `до ${formatDate(expiryDate)}`;
        } else {
            return 'Подписка истекла';
        }
    }
    
    return 'Нет подписки';
}

// Форматирование даты
function formatDate(date) {
    return date.toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Инициализация обработчиков событий
function initializeEventListeners() {
    // Кнопки действий
    document.getElementById('changeRAMBtn').addEventListener('click', openRAMModal);
    document.getElementById('activateKeyBtn').addEventListener('click', openKeyModal);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    // Админ панель
    const adminBtn = document.getElementById('adminPanelBtn');
    if (adminBtn) {
        adminBtn.addEventListener('click', openAdminPanel);
    }
    
    // Модальные окна
    initializeModals();
    
    // Формы
    document.getElementById('ramForm').addEventListener('submit', handleRAMChange);
    document.getElementById('keyForm').addEventListener('submit', handleKeyActivation);
}

// Инициализация модальных окон
function initializeModals() {
    const modals = document.querySelectorAll('.modal');
    const closeButtons = document.querySelectorAll('.close');
    
    // Закрытие модальных окон
    closeButtons.forEach(button => {
        button.addEventListener('click', function() {
            const modal = this.closest('.modal');
            modal.style.display = 'none';
        });
    });
    
    // Закрытие при клике вне модального окна
    window.addEventListener('click', function(event) {
        modals.forEach(modal => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
}

// Открытие модального окна RAM
function openRAMModal() {
    document.getElementById('ramModal').style.display = 'block';
}

// Открытие модального окна активации ключа
function openKeyModal() {
    document.getElementById('keyModal').style.display = 'block';
}

// Открытие админ панели
function openAdminPanel() {
    showNotification('Переход в админ панель...', 'info');
    setTimeout(() => {
        window.open('/admin', '_blank');
    }, 500);
}

// Обработка изменения RAM
function handleRAMChange(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const ramAmount = formData.get('ramAmount');
    
    // Здесь можно добавить отправку данных на сервер
    showNotification(`RAM изменен на ${ramAmount} GB`, 'success');
    document.getElementById('ramModal').style.display = 'none';
    
    // Сохранение в localStorage для демонстрации
    localStorage.setItem('userRAM', ramAmount);
}

// Обработка активации ключа
async function handleKeyActivation(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const activationKey = formData.get('activationKey');
    
    if (!activationKey) {
        showNotification('Введите ключ активации', 'error');
        return;
    }
    
    try {
        // Получаем UID текущего пользователя
        const authResponse = await fetch('/api/auth/status');
        const authData = await authResponse.json();
        
        if (!authData.authenticated) {
            showNotification('Ошибка аутентификации', 'error');
            return;
        }
        
        // Активируем ключ
        const response = await fetch('/api/activate-key', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                key: activationKey,
                uid: authData.user.uid
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification(`Ключ успешно активирован! Подписка: ${data.subscription_type}`, 'success');
            document.getElementById('keyModal').style.display = 'none';
            document.getElementById('keyForm').reset();
            
            // Перезагрузка профиля для обновления подписки
            setTimeout(() => {
                loadUserProfile();
            }, 1000);
        } else {
            showNotification(data.error || 'Ошибка активации ключа', 'error');
        }
        
    } catch (error) {
        console.error('Ошибка активации ключа:', error);
        showNotification('Ошибка подключения к серверу', 'error');
    }
}

// Выход из системы
async function logout() {
    try {
        const response = await fetch('/api/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            // Очистка локального хранилища
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            
            showNotification('Вы успешно вышли из системы', 'success');
            
            // Перенаправление на главную страницу
            setTimeout(() => {
                window.location.href = '/';
            }, 1500);
        } else {
            throw new Error('Ошибка выхода из системы');
        }
    } catch (error) {
        console.error('Ошибка выхода:', error);
        showNotification('Ошибка выхода из системы', 'error');
    }
}

// Показ уведомлений
function showNotification(message, type = 'info') {
    // Удаление существующих уведомлений
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
    
    // Создание нового уведомления
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Добавление иконки
    const icon = document.createElement('i');
    switch (type) {
        case 'success':
            icon.className = 'fas fa-check-circle';
            break;
        case 'error':
            icon.className = 'fas fa-exclamation-circle';
            break;
        case 'info':
        default:
            icon.className = 'fas fa-info-circle';
            break;
    }
    
    notification.prepend(icon);
    notification.prepend(' ');
    
    document.body.appendChild(notification);
    
    // Автоматическое удаление через 5 секунд
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }
    }, 5000);
}

// Показ индикатора загрузки
function showLoading() {
    const loadingElements = document.querySelectorAll('.info-value');
    loadingElements.forEach(element => {
        if (element.id) { // Только элементы с ID
            element.innerHTML = '<span class="loading"></span>';
        }
    });
}

// Скрытие индикатора загрузки
function hideLoading() {
    // Загрузка завершена, данные уже обновлены в updateUserInterface
}

// Обновление статуса онлайн
function updateOnlineStatus() {
    const statusElement = document.querySelector('.status-online, .status-offline');
    if (statusElement) {
        statusElement.textContent = navigator.onLine ? 'Онлайн' : 'Оффлайн';
        statusElement.className = navigator.onLine ? 'stat-value status-online' : 'stat-value status-offline';
    }
}

// Отслеживание статуса подключения
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// Обновление панели загрузок в зависимости от подписки
function updateDownloadsPanel(user) {
    const downloadsPanel = document.getElementById('downloadsPanel');
    const subscriptionPanel = document.getElementById('subscriptionPanel');
    
    // Проверяем, есть ли активная подписка
    const hasActiveSubscription = user.subscription_type && user.subscription_type !== 'none';
    const isSubscriptionValid = hasActiveSubscription && (!user.subscription_expires || new Date(user.subscription_expires) > new Date());
    
    if (hasActiveSubscription && (user.subscription_type === 'lifetime' || isSubscriptionValid)) {
        // Показываем панель загрузок
        downloadsPanel.style.display = 'block';
        subscriptionPanel.style.display = 'none';
        console.log('✅ Панель загрузок доступна для подписки:', user.subscription_type);
    } else {
        // Показываем панель с сообщением о необходимости подписки
        downloadsPanel.style.display = 'none';
        subscriptionPanel.style.display = 'block';
        console.log('❌ Панель загрузок недоступна - нет активной подписки');
    }
}

// Функции для загрузок
function downloadClient() {
    // Здесь можно добавить реальную ссылку на скачивание
    showNotification('Начинается загрузка Achba Client v2.1.0...', 'info');
    
    // Симуляция загрузки
    setTimeout(() => {
        showNotification('Загрузка завершена!', 'success');
    }, 2000);
}

function openConfigs() {
    showNotification('Открытие панели конфигураций...', 'info');
    // Здесь можно открыть модальное окно с конфигурациями или перенаправить на другую страницу
}

// Добавление CSS анимации для slideOutRight
if (!document.querySelector('#notificationAnimations')) {
    const style = document.createElement('style');
    style.id = 'notificationAnimations';
    style.textContent = `
        @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}
