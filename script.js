/**
 * STARFIXER: ПОСЛЕДНИЙ СИГНАЛ — ИНТЕРАКТИВНОСТЬ
 * Без сторонних библиотек, чистый JavaScript
 */

document.addEventListener('DOMContentLoaded', () => {
    // ----------------------------------------------
    // 1. АНИМИРОВАННОЕ ЗВЁЗДНОЕ НЕБО (canvas)
    // ----------------------------------------------
    const canvas = document.getElementById('starfield-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width, height;
    const STAR_COUNT = 180;        // количество звёзд
    const stars = [];

    // Инициализация массива звёзд
    function initStars() {
        stars.length = 0;
        for (let i = 0; i < STAR_COUNT; i++) {
            stars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                radius: Math.random() * 1.8 + 0.5,
                brightness: Math.random() * 0.5 + 0.5, // для мерцания
                speed: Math.random() * 0.02 + 0.01,    // скорость мерцания
                color: Math.random() < 0.08 ? 'rgba(0, 229, 255, 0.9)' : 'rgba(255, 255, 255, 0.8)'
            });
        }
    }

    // Обновить размеры canvas при ресайзе
    function resizeCanvas() {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
        initStars();
    }

    // Отрисовка одного кадра
    function drawStars() {
        ctx.clearRect(0, 0, width, height);

        stars.forEach(star => {
            // Мерцание: случайное изменение яркости вокруг базового значения
            const flicker = Math.sin(Date.now() * star.speed * 0.1 + star.x) * 0.15;
            const alpha = Math.min(1, Math.max(0.2, star.brightness + flicker));

            ctx.beginPath();
            ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
            ctx.fillStyle = star.color.replace('0.8', alpha).replace('0.9', alpha);
            ctx.fill();

            // Лёгкое свечение у ярких звёзд
            if (star.radius > 1.4) {
                ctx.shadowColor = 'rgba(0, 229, 255, 0.4)';
                ctx.shadowBlur = 4;
                ctx.fill();
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
            }
        });

        requestAnimationFrame(drawStars);
    }

    // Запуск звёздного неба
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    drawStars();

    // ----------------------------------------------
    // 2. МОБИЛЬНОЕ МЕНЮ (гамбургер)
    // ----------------------------------------------
    const menuToggle = document.getElementById('menu-toggle');
    const navLinks = document.getElementById('nav-links');

    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
            menuToggle.setAttribute('aria-expanded', !expanded);
            menuToggle.classList.toggle('open');
            navLinks.classList.toggle('active');
        });

        // Закрытие меню при клике на ссылку (для мобильных)
        navLinks.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                if (navLinks.classList.contains('active')) {
                    menuToggle.setAttribute('aria-expanded', 'false');
                    menuToggle.classList.remove('open');
                    navLinks.classList.remove('active');
                }
            });
        });
    }

    // ----------------------------------------------
    // 3. ЭФФЕКТ ПОЯВЛЕНИЯ СЕКЦИЙ ПРИ ПРОКРУТКЕ
    // ----------------------------------------------
    const revealSections = document.querySelectorAll('.section-reveal');

    function checkReveal() {
        const triggerBottom = window.innerHeight * 0.85;

        revealSections.forEach(section => {
            const sectionTop = section.getBoundingClientRect().top;
            if (sectionTop < triggerBottom) {
                section.classList.add('visible');
            }
        });
    }

    // Первичная проверка и при скролле
    window.addEventListener('scroll', checkReveal, { passive: true });
    checkReveal(); // на случай, если секции уже видны

    // ----------------------------------------------
    // 4. ДОБАВЛЕНИЕ КЛАССА ПРОКРУТКИ НА ШАПКУ
    // ----------------------------------------------
    const header = document.getElementById('site-header');
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        }, { passive: true });
    }

    // ----------------------------------------------
    // 5. ПЛАВНАЯ ПРОКРУТКА ДЛЯ ВСЕХ ЯКОРНЫХ ССЫЛОК (уже есть scroll-behavior, но на всякий случай)
    // ----------------------------------------------
    // Встроенный smooth scroll работает в современных браузерах.
    // Дополнительно ничего не требуется.

    // ----------------------------------------------
    // 6. ОБРАБОТКА ФОКУСА ДЛЯ КАРТОЧЕК (улучшение доступности)
    // ----------------------------------------------
    // Карточки финального выбора и особенностей при фокусе с клавиатуры получают hover-стили
    const focusableCards = document.querySelectorAll('.feature-card, .choice-card');
    focusableCards.forEach(card => {
        card.addEventListener('focus', () => {
            card.style.outline = '2px solid var(--accent-energy)';
        });
        card.addEventListener('blur', () => {
            card.style.outline = '';
        });
    });

    console.log('Starfixer: Все системы запущены. Готов к исследованию.');
});
