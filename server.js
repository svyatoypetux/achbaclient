const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'achba_super_secret_key_2025';

// KeyAuth Configuration
const KEYAUTH_CONFIG = {
    name: "Achba",
    ownerid: "BsLYZcAtx0", 
    version: "1.0"
};

// Middleware
app.use(helmet({
    contentSecurityPolicy: false // Отключаем для разработки
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting отключен для разработки
// const limiter = rateLimit({
//     windowMs: 15 * 60 * 1000, // 15 минут
//     max: 1000 // максимум 1000 запросов с одного IP
// });
// app.use(limiter);

// Более мягкий лимит для аутентификации (отключен для разработки)
const authLimiter = (req, res, next) => next(); // Пустая функция для разработки

// Session middleware
app.use(session({
    secret: JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // true для HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 часа
    }
}));

// Статические файлы
app.use(express.static(path.join(__dirname)));

// Определяем окружение
const isProduction = process.env.NODE_ENV === 'production';

let db;

if (isProduction) {
    // Конфигурация MySQL для продакшена
    const dbConfig = {
        host: 'sql100.infinityfree.com',
        user: 'if0_40484114',
        password: 'ptl4dPxXR1cljQ',
        database: 'if0_40484114_achbaclient',
        port: 3306,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        ssl: {
            rejectUnauthorized: false
        }
    };
    
    db = mysql.createPool(dbConfig);
    console.log('🔗 Используется MySQL для продакшена');
} else {
    // SQLite для локальной разработки
    db = new sqlite3.Database('./database.db', (err) => {
        if (err) {
            console.error('Ошибка подключения к SQLite:', err.message);
        } else {
            console.log('✅ Подключение к SQLite базе данных установлено');
        }
    });
    console.log('🔗 Используется SQLite для разработки');
}

// Инициализация базы данных
if (isProduction) {
    // Для MySQL
    async function connectAndInitialize() {
        try {
            const connection = await db.getConnection();
            console.log('✅ Подключение к MySQL базе данных установлено');
            connection.release();
            await initializeMySQLDatabase();
        } catch (err) {
            console.error('Ошибка подключения к MySQL:', err.message);
            process.exit(1);
        }
    }
    connectAndInitialize();
} else {
    // Для SQLite
    initializeSQLiteDatabase();
}

// Создание таблиц для MySQL
async function initializeMySQLDatabase() {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS users (
                uid INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'user',
                hwid VARCHAR(255) DEFAULT NULL,
                subscription_type VARCHAR(50) DEFAULT 'none',
                subscription_expires DATETIME DEFAULT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME DEFAULT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                is_banned BOOLEAN DEFAULT FALSE,
                ban_reason TEXT DEFAULT NULL,
                ban_expires DATETIME DEFAULT NULL,
                banned_by VARCHAR(255) DEFAULT NULL,
                banned_at DATETIME DEFAULT NULL,
                security_code INT DEFAULT NULL
            )
        `);
        console.log('✅ Таблица users создана или уже существует');

        await db.execute(`
            CREATE TABLE IF NOT EXISTS sessions (
                id VARCHAR(255) PRIMARY KEY,
                user_uid INT,
                token TEXT NOT NULL,
                expires_at DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_uid) REFERENCES users (uid)
            )
        `);
        console.log('✅ Таблица sessions создана или уже существует');

        await db.execute(`
            CREATE TABLE IF NOT EXISTS license_keys (
                id INT AUTO_INCREMENT PRIMARY KEY,
                key_value VARCHAR(255) UNIQUE NOT NULL,
                subscription_type VARCHAR(50) NOT NULL,
                duration_days INT NOT NULL,
                is_used BOOLEAN DEFAULT FALSE,
                used_by INT DEFAULT NULL,
                used_at DATETIME DEFAULT NULL,
                created_by VARCHAR(255) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME DEFAULT NULL,
                FOREIGN KEY (used_by) REFERENCES users (uid)
            )
        `);
        console.log('✅ Таблица license_keys создана или уже существует');

        // Обновляем роль zibbora на admin
        await updateZibboraRoleMySQL();
    } catch (err) {
        console.error('Ошибка создания таблиц MySQL:', err.message);
    }
}

// Создание таблиц для SQLite
function initializeSQLiteDatabase() {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            uid INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            hwid TEXT DEFAULT NULL,
            subscription_type TEXT DEFAULT 'none',
            subscription_expires DATETIME DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME DEFAULT NULL,
            is_active BOOLEAN DEFAULT 1,
            is_banned BOOLEAN DEFAULT 0,
            ban_reason TEXT DEFAULT NULL,
            ban_expires DATETIME DEFAULT NULL,
            banned_by TEXT DEFAULT NULL,
            banned_at DATETIME DEFAULT NULL,
            security_code INTEGER DEFAULT NULL
        )
    `, (err) => {
        if (err) {
            console.error('Ошибка создания таблицы users:', err.message);
        } else {
            console.log('✅ Таблица users создана или уже существует');
            updateZibboraRoleSQLite();
        }
    });

    db.run(`
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            user_uid INTEGER,
            token TEXT NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_uid) REFERENCES users (uid)
        )
    `, (err) => {
        if (err) {
            console.error('Ошибка создания таблицы sessions:', err.message);
        } else {
            console.log('✅ Таблица sessions создана или уже существует');
        }
    });

    db.run(`
        CREATE TABLE IF NOT EXISTS license_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key_value TEXT UNIQUE NOT NULL,
            subscription_type TEXT NOT NULL,
            duration_days INTEGER NOT NULL,
            is_used BOOLEAN DEFAULT 0,
            used_by INTEGER DEFAULT NULL,
            used_at DATETIME DEFAULT NULL,
            created_by TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME DEFAULT NULL,
            FOREIGN KEY (used_by) REFERENCES users (uid)
        )
    `, (err) => {
        if (err) {
            console.error('Ошибка создания таблицы license_keys:', err.message);
        } else {
            console.log('✅ Таблица license_keys создана или уже существует');
        }
    });
}

// Обновление роли zibbora на admin для MySQL
async function updateZibboraRoleMySQL() {
    try {
        const [result] = await db.execute('UPDATE users SET role = ? WHERE username = ?', ['admin', 'zibbora']);
        if (result.affectedRows > 0) {
            console.log('👑 Роль zibbora обновлена на admin');
        }
    } catch (err) {
        console.error('Ошибка обновления роли zibbora:', err.message);
    }
}

// Обновление роли zibbora на admin для SQLite
function updateZibboraRoleSQLite() {
    db.run('UPDATE users SET role = ? WHERE username = ?', ['admin', 'zibbora'], function(err) {
        if (err) {
            console.error('Ошибка обновления роли zibbora:', err);
        } else if (this.changes > 0) {
            console.log('👑 Роль zibbora обновлена на admin');
        }
    });
}

// Middleware для проверки аутентификации
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1] || req.session.token;

    if (!token) {
        return res.status(401).json({ error: 'Токен доступа отсутствует' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Недействительный токен' });
        }
        req.user = user;
        next();
    });
}

// API Routes

// Регистрация
app.post('/api/register', authLimiter, async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Валидация
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Все поля обязательны для заполнения' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
        }

        // Проверка на существование пользователя
        db.get('SELECT uid FROM users WHERE username = ? OR email = ?', [username, email], async (err, row) => {
            if (err) {
                console.error('Ошибка проверки пользователя:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
            }

            if (row) {
                return res.status(400).json({ error: 'Пользователь с таким именем или email уже существует' });
            }

            // Хеширование пароля
            const hashedPassword = await bcrypt.hash(password, 12);

            // Создание пользователя
            db.run(
                'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
                [username, email, hashedPassword],
                function(err) {
                    if (err) {
                        console.error('Ошибка создания пользователя:', err);
                        return res.status(500).json({ error: 'Ошибка создания пользователя' });
                    }

                    const uid = this.lastID;
                    console.log(`✅ Новый пользователь зарегистрирован: ${username} (UID: ${uid})`);

                    res.status(201).json({
                        success: true,
                        message: 'Пользователь успешно зарегистрирован',
                        uid: uid
                    });
                }
            );
        });
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Авторизация
app.post('/api/login', authLimiter, (req, res) => {
    try {
        const { email, password } = req.body;

        console.log('🔐 Попытка входа:', { email, passwordLength: password?.length });

        if (!email || !password) {
            return res.status(400).json({ error: 'Email и пароль обязательны' });
        }

        db.get('SELECT * FROM users WHERE (email = ? OR username = ?) AND is_active = 1', [email, email], async (err, user) => {
            if (err) {
                console.error('Ошибка поиска пользователя:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
            }

            console.log('👤 Найден пользователь:', user ? `${user.username} (UID: ${user.uid})` : 'НЕ НАЙДЕН');

            if (!user) {
                console.log('❌ Пользователь не найден для email:', email);
                return res.status(401).json({ error: 'Неверный email или пароль' });
            }

            // Проверка на бан
            if (user.is_banned) {
                const now = new Date();
                const banExpires = user.ban_expires ? new Date(user.ban_expires) : null;
                
                if (!banExpires || banExpires > now) {
                    const banMessage = banExpires 
                        ? `Вы забанены до ${banExpires.toLocaleDateString('ru-RU', { 
                            year: 'numeric', month: '2-digit', day: '2-digit', 
                            hour: '2-digit', minute: '2-digit' 
                          })}. Причина: ${user.ban_reason || 'Не указана'}`
                        : `Вы забанены навсегда. Причина: ${user.ban_reason || 'Не указана'}`;
                    
                    console.log('🚫 Попытка входа забаненного пользователя:', user.username);
                    return res.status(403).json({ error: banMessage });
                } else {
                    // Бан истек, снимаем его
                    db.run('UPDATE users SET is_banned = 0, ban_reason = NULL, ban_expires = NULL, banned_by = NULL, banned_at = NULL WHERE uid = ?', [user.uid]);
                    console.log('✅ Бан истек для пользователя:', user.username);
                }
            }

            console.log('🔑 Проверка пароля...');
            const isPasswordValid = await bcrypt.compare(password, user.password);
            console.log('🔑 Результат проверки пароля:', isPasswordValid);
            
            if (!isPasswordValid) {
                console.log('❌ Неверный пароль для пользователя:', user.username);
                return res.status(401).json({ error: 'Неверный email или пароль' });
            }

            // Создание JWT токена
            const token = jwt.sign(
                { 
                    uid: user.uid, 
                    username: user.username, 
                    email: user.email,
                    role: user.role 
                },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            // Обновление времени последнего входа
            db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE uid = ?', [user.uid]);

            // Сохранение токена в сессии
            req.session.token = token;
            req.session.user = {
                uid: user.uid,
                username: user.username,
                email: user.email,
                role: user.role
            };

            console.log(`✅ Пользователь ${user.username} (UID: ${user.uid}) вошел в систему`);

            res.json({
                success: true,
                message: 'Успешная авторизация',
                token: token,
                user: {
                    uid: user.uid,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    subscription_type: user.subscription_type,
                    created_at: user.created_at
                }
            });
        });
    } catch (error) {
        console.error('Ошибка авторизации:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Получение информации о пользователе
app.get('/api/user/profile', authenticateToken, (req, res) => {
    // Всегда получаем актуальную информацию из базы данных
    db.get('SELECT uid, username, email, role, subscription_type, subscription_expires, created_at, last_login FROM users WHERE uid = ?', 
        [req.user.uid], (err, user) => {
        if (err) {
            console.error('Ошибка получения профиля:', err);
            return res.status(500).json({ error: 'Ошибка сервера' });
        }

        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        // Обновляем сессию с актуальными данными
        if (req.session.user) {
            req.session.user.role = user.role;
            req.session.user.subscription_type = user.subscription_type;
        }

        console.log(`📋 Профиль загружен для ${user.username}: роль=${user.role}, подписка=${user.subscription_type}`);

        res.json({
            success: true,
            user: user
        });
    });
});

// Выход из системы
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Ошибка выхода:', err);
            return res.status(500).json({ error: 'Ошибка выхода из системы' });
        }
        
        res.json({ success: true, message: 'Успешный выход из системы' });
    });
});

// Проверка статуса аутентификации
app.get('/api/auth/status', (req, res) => {
    if (req.session.user) {
        res.json({ 
            authenticated: true, 
            user: req.session.user 
        });
    } else {
        res.json({ authenticated: false });
    }
});

// Админ API - получение всех пользователей
app.get('/api/admin/users', (req, res) => {
    db.all(`SELECT uid, username, email, role, subscription_type, subscription_expires, 
                   created_at, last_login, is_active, is_banned, ban_reason, ban_expires, banned_by
            FROM users 
            ORDER BY uid ASC`, (err, users) => {
        if (err) {
            console.error('Ошибка получения пользователей:', err);
            return res.status(500).json({ error: 'Ошибка сервера' });
        }

        res.json({
            success: true,
            users: users,
            total: users.length
        });
    });
});

// Админ API - забанить пользователя
app.post('/api/admin/ban-user', (req, res) => {
    const { uid, reason, days, bannedBy } = req.body;
    
    if (!uid || !reason || !bannedBy) {
        return res.status(400).json({ error: 'Не указаны обязательные поля' });
    }
    
    let banExpires = null;
    if (days && days > 0) {
        banExpires = new Date();
        banExpires.setDate(banExpires.getDate() + parseInt(days));
    }
    
    db.run(`UPDATE users SET 
                is_banned = 1, 
                ban_reason = ?, 
                ban_expires = ?, 
                banned_by = ?, 
                banned_at = CURRENT_TIMESTAMP 
            WHERE uid = ?`, 
        [reason, banExpires, bannedBy, uid], 
        function(err) {
            if (err) {
                console.error('Ошибка бана пользователя:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Пользователь не найден' });
            }
            
            console.log(`🚫 Пользователь UID:${uid} забанен администратором ${bannedBy}`);
            res.json({ success: true, message: 'Пользователь забанен' });
        }
    );
});

// Админ API - разбанить пользователя
app.post('/api/admin/unban-user', (req, res) => {
    const { uid } = req.body;
    
    if (!uid) {
        return res.status(400).json({ error: 'Не указан UID пользователя' });
    }
    
    db.run(`UPDATE users SET 
                is_banned = 0, 
                ban_reason = NULL, 
                ban_expires = NULL, 
                banned_by = NULL, 
                banned_at = NULL 
            WHERE uid = ?`, 
        [uid], 
        function(err) {
            if (err) {
                console.error('Ошибка разбана пользователя:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Пользователь не найден' });
            }
            
            console.log(`✅ Пользователь UID:${uid} разбанен`);
            res.json({ success: true, message: 'Пользователь разбанен' });
        }
    );
});

// Админ API - удалить пользователя
app.delete('/api/admin/delete-user', (req, res) => {
    const { uid } = req.body;
    
    if (!uid) {
        return res.status(400).json({ error: 'Не указан UID пользователя' });
    }
    
    // Сначала получаем информацию о пользователе
    db.get('SELECT username FROM users WHERE uid = ?', [uid], (err, user) => {
        if (err) {
            console.error('Ошибка поиска пользователя:', err);
            return res.status(500).json({ error: 'Ошибка сервера' });
        }
        
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        // Удаляем пользователя
        db.run('DELETE FROM users WHERE uid = ?', [uid], function(err) {
            if (err) {
                console.error('Ошибка удаления пользователя:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
            }
            
            console.log(`🗑️ Пользователь ${user.username} (UID:${uid}) удален`);

            // Сбрасываем AUTOINCREMENT, чтобы следующий UID шёл от максимального существующего
            db.run(`UPDATE sqlite_sequence SET seq = (SELECT IFNULL(MAX(uid), 0) FROM users) WHERE name = 'users'`, (seqErr) => {
                if (seqErr) {
                    console.error('Ошибка сброса последовательности UID:', seqErr.message);
                }

                res.json({ success: true, message: 'Пользователь удален' });
            });
        });
    });
});

// Админ API - изменить роль пользователя (только для zibbora)
app.post('/api/admin/change-role', (req, res) => {
    const { username, role, admin_requester } = req.body;
    
    if (!username || !role || !admin_requester) {
        return res.status(400).json({ error: 'Не указаны обязательные поля' });
    }
    
    // Проверяем, что запрос от zibbora
    if (admin_requester !== 'zibbora') {
        return res.status(403).json({ error: 'Только zibbora может изменять роли пользователей' });
    }
    
    // Список допустимых ролей
    const allowedRoles = ['user', 'admin', 'support', 'media', 'moder'];
    if (!allowedRoles.includes(role)) {
        return res.status(400).json({ error: 'Недопустимая роль' });
    }
    
    // Генерируем код безопасности только для админов
    let securityCode = null;
    if (role === 'admin') {
        securityCode = Math.floor(10000 + Math.random() * 90000);
    }
    
    const query = securityCode ? 
        'UPDATE users SET role = ?, security_code = ? WHERE username = ?' :
        'UPDATE users SET role = ?, security_code = NULL WHERE username = ?';
    const params = securityCode ? [role, securityCode, username] : [role, username];
    
    db.run(query, params, function(err) {
        if (err) {
            console.error('Ошибка изменения роли:', err);
            return res.status(500).json({ error: 'Ошибка сервера' });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        const roleNames = {
            'user': 'пользователем',
            'admin': 'администратором',
            'support': 'саппортом',
            'media': 'медиа',
            'moder': 'модератором'
        };
        
        console.log(`👑 Пользователь ${username} назначен ${roleNames[role]}${securityCode ? ` с кодом ${securityCode}` : ''}`);
        res.json({ 
            success: true, 
            message: `Пользователь назначен ${roleNames[role]}`,
            security_code: securityCode,
            role: role
        });
    });
});

// Админ API - сделать пользователя админом (только для zibbora) - DEPRECATED, используй change-role
app.post('/api/admin/make-admin', (req, res) => {
    const { username, admin_requester } = req.body;
    
    if (!username || !admin_requester) {
        return res.status(400).json({ error: 'Не указаны обязательные поля' });
    }
    
    // Проверяем, что запрос от zibbora
    if (admin_requester !== 'zibbora') {
        return res.status(403).json({ error: 'Только zibbora может назначать администраторов' });
    }
    
    // Генерируем код безопасности
    const securityCode = Math.floor(10000 + Math.random() * 90000);
    
    db.run('UPDATE users SET role = ?, security_code = ? WHERE username = ?', ['admin', securityCode, username], function(err) {
        if (err) {
            console.error('Ошибка назначения админа:', err);
            return res.status(500).json({ error: 'Ошибка сервера' });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        console.log(`👑 Пользователь ${username} назначен администратором с кодом ${securityCode}`);
        res.json({ 
            success: true, 
            message: 'Пользователь назначен администратором',
            security_code: securityCode
        });
    });
});

// Админ API - забрать подписку у пользователя
app.post('/api/admin/remove-subscription', (req, res) => {
    const { uid } = req.body;
    
    if (!uid) {
        return res.status(400).json({ error: 'Не указан UID пользователя' });
    }
    
    db.run(`UPDATE users SET 
                subscription_type = 'none', 
                subscription_expires = NULL 
            WHERE uid = ?`, 
        [uid], 
        function(err) {
            if (err) {
                console.error('Ошибка удаления подписки:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Пользователь не найден' });
            }
            
            console.log(`❌ Подписка удалена у пользователя UID:${uid}`);
            res.json({ success: true, message: 'Подписка удалена' });
        }
    );
});

// Админ API - выдать подписку пользователю напрямую
app.post('/api/admin/grant-subscription', (req, res) => {
    const { uid, duration_days } = req.body;

    if (!uid || duration_days === undefined) {
        return res.status(400).json({ error: 'Не указаны обязательные поля (uid и duration_days)' });
    }

    const days = parseInt(duration_days, 10);
    if (Number.isNaN(days) || days < 0) {
        return res.status(400).json({ error: 'Неверное значение дней' });
    }

    let subscription_type = 'subscription';
    let expiresAt = null;

    if (days === 0) {
        subscription_type = 'lifetime';
    } else {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);
    }

    db.run(
        `UPDATE users SET 
            subscription_type = ?, 
            subscription_expires = ?
        WHERE uid = ?`,
        [subscription_type, expiresAt, uid],
        function(err) {
            if (err) {
                console.error('Ошибка выдачи подписки:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'Пользователь не найден' });
            }

            console.log(`✅ Подписка (${subscription_type}, дней: ${days}) выдана пользователю UID:${uid}`);
            res.json({ success: true, message: 'Подписка выдана', subscription_type, duration_days: days });
        }
    );
});

// Админ API - генерация ключа
app.post('/api/admin/generate-key', (req, res) => {
    const { duration_days, created_by } = req.body;
    
    if (duration_days === undefined || !created_by) {
        return res.status(400).json({ error: 'Не указаны обязательные поля' });
    }
    
    // Определяем тип подписки на основе дней
    let subscription_type = 'subscription';
    if (duration_days == 0) {
        subscription_type = 'lifetime';
    }
    
    // Генерируем уникальный ключ
    const keyValue = generateLicenseKey();
    
    db.run(`INSERT INTO license_keys (key_value, subscription_type, duration_days, created_by) 
            VALUES (?, ?, ?, ?)`, 
        [keyValue, subscription_type, duration_days, created_by], 
        function(err) {
            if (err) {
                console.error('Ошибка создания ключа:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
            }
            
            const daysText = duration_days == 0 ? 'пожизненная' : `${duration_days} дней`;
            console.log(`🔑 Создан ключ ${keyValue} (${daysText})`);
            res.json({ 
                success: true, 
                key: keyValue,
                duration_days
            });
        }
    );
});

// Админ API - получение всех ключей
app.get('/api/admin/keys', (req, res) => {
    db.all(`SELECT * FROM license_keys ORDER BY created_at DESC`, (err, keys) => {
        if (err) {
            console.error('Ошибка получения ключей:', err);
            return res.status(500).json({ error: 'Ошибка сервера' });
        }

        res.json({
            success: true,
            keys: keys
        });
    });
});

// Админ API - получение всех администраторов
app.get('/api/admin/admins', (req, res) => {
    db.all(`SELECT uid, username, email, security_code, created_at FROM users WHERE role = 'admin' ORDER BY created_at ASC`, (err, admins) => {
        if (err) {
            console.error('Ошибка получения админов:', err);
            return res.status(500).json({ error: 'Ошибка сервера' });
        }

        res.json({
            success: true,
            admins: admins
        });
    });
});

// API - активация ключа
app.post('/api/activate-key', (req, res) => {
    const { key, uid } = req.body;
    
    if (!key || !uid) {
        return res.status(400).json({ error: 'Не указаны обязательные поля' });
    }
    
    // Проверяем ключ
    db.get('SELECT * FROM license_keys WHERE key_value = ? AND is_used = 0', [key], (err, licenseKey) => {
        if (err) {
            console.error('Ошибка поиска ключа:', err);
            return res.status(500).json({ error: 'Ошибка сервера' });
        }
        
        if (!licenseKey) {
            return res.status(404).json({ error: 'Ключ не найден или уже использован' });
        }
        
        // Вычисляем дату окончания подписки
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + licenseKey.duration_days);
        
        // Обновляем пользователя
        db.run(`UPDATE users SET 
                    subscription_type = ?, 
                    subscription_expires = ? 
                WHERE uid = ?`, 
            [licenseKey.subscription_type, expiresAt, uid], 
            function(err) {
                if (err) {
                    console.error('Ошибка обновления подписки:', err);
                    return res.status(500).json({ error: 'Ошибка сервера' });
                }
                
                // Отмечаем ключ как использованный
                db.run(`UPDATE license_keys SET 
                            is_used = 1, 
                            used_by = ?, 
                            used_at = CURRENT_TIMESTAMP 
                        WHERE key_value = ?`, 
                    [uid, key], 
                    (err) => {
                        if (err) {
                            console.error('Ошибка обновления ключа:', err);
                        }
                    }
                );
                
                console.log(`✅ Ключ ${key} активирован пользователем UID:${uid}`);
                res.json({ 
                    success: true, 
                    message: 'Ключ успешно активирован!',
                    subscription_type: licenseKey.subscription_type,
                    expires_at: expiresAt
                });
            }
        );
    });
});

// Функция генерации ключа
function generateLicenseKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 16; i++) {
        if (i > 0 && i % 4 === 0) result += '-';
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Главная страница - перенаправление на статический файл
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Личный кабинет
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'dashboard.html'));
});

// Админ панель
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'admin.html'));
});

// Обработка 404
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'pages', '404.html'));
});

// Обработка ошибок
app.use((err, req, res, next) => {
    console.error('Ошибка сервера:', err.stack);
    res.status(500).json({ error: 'Что-то пошло не так!' });
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🔄 Завершение работы сервера...');
    db.close((err) => {
        if (err) {
            console.error('Ошибка закрытия базы данных:', err.message);
        } else {
            console.log('✅ База данных закрыта');
        }
        process.exit(0);
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Сервер Achba запущен на порту ${PORT}`);
    console.log(`🌐 Откройте http://localhost:${PORT} в браузере`);
});
