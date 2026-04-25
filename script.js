window.selectService = function (checkboxName, text) {
    const checkbox = document.querySelector(`input[name="${checkboxName}"]`);
    if (checkbox) checkbox.checked = true;

    const textarea = document.getElementById('diagnostico');
    if (textarea) {
        if (!textarea.value) {
            textarea.value = `Motivo de consulta: ${text}. `;
        } else if (!textarea.value.includes(text)) {
            textarea.value += `\nMotivo de consulta: ${text}. `;
        }
    }

    // Smooth scroll to contact form with offset
    const formSection = document.getElementById('contacto');
    if (formSection) {
        const headerOffset = 80; // approximate height of navbar
        const elementPosition = formSection.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
            top: offsetPosition,
            behavior: "smooth"
        });

        // Highlight form briefly
        const formContainer = document.querySelector('.contact-form-container');
        if (formContainer) {
            formContainer.style.boxShadow = "0 0 0 4px rgba(42, 157, 143, 0.3)";
            setTimeout(() => {
                formContainer.style.boxShadow = "none";
            }, 1000);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {

    // --- Check for URL parameters to pre-fill the form ---
    const urlParams = new URLSearchParams(window.location.search);
    const serviceParam = urlParams.get('service');
    const textParam = urlParams.get('text');

    if (serviceParam && typeof window.selectService === 'function') {
        // Pre-fill form (wait slightly for rendering)
        setTimeout(() => {
            window.selectService(`servicios_${serviceParam}`, textParam || 'Consulta');
            // Clean up the URL to prevent re-triggering on fresh reloads
            const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + "#contacto";
            window.history.replaceState({ path: newUrl }, '', newUrl);
        }, 100);
    }

    // --- Navbar Scroll Effect ---
    const navbar = document.getElementById('navbar');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // --- Mobile Menu Toggle ---
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const mobileNav = document.querySelector('.mobile-nav');
    const mobileLinks = document.querySelectorAll('.mobile-link, .mobile-btn');

    if (mobileMenuBtn && mobileNav) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileNav.classList.toggle('open');
            // Toggle icon
            const icon = mobileMenuBtn.querySelector('.material-icons-outlined');
            if (mobileNav.classList.contains('open')) {
                icon.textContent = 'close';
            } else {
                icon.textContent = 'menu';
            }
        });

        // Close mobile menu when a link is clicked
        mobileLinks.forEach(link => {
            link.addEventListener('click', () => {
                mobileNav.classList.remove('open');
                const icon = mobileMenuBtn.querySelector('.material-icons-outlined');
                icon.textContent = 'menu';
            });
        });
    }

    // --- Active Link Switching on Scroll (Basic Version) ---
    // A primitive observer for now. Can be enhanced later to highlight active sections in the navbar.

    // --- Scroll Animations with Intersection Observer ---
    const animatedElements = document.querySelectorAll('.fade-in-up');

    if ('IntersectionObserver' in window) {
        const observerOptions = {
            root: null,
            rootMargin: '0px',
            threshold: 0.15
        };

        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    // Stop observing once animated
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        animatedElements.forEach(el => observer.observe(el));
    } else {
        // Fallback for older browsers
        animatedElements.forEach(el => el.classList.add('is-visible'));
    }

    // --- Contact Form Logic ---
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = contactForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = "Enviando...";
            submitBtn.disabled = true;

            const formData = new FormData(contactForm);
            const data = Object.fromEntries(formData.entries());
            
            data.servicios_medicos = formData.get('servicios_medicos') === 'true';
            data.servicios_kinesiologia = formData.get('servicios_kinesiologia') === 'true';
            data.servicios_cuidadores = formData.get('servicios_cuidadores') === 'true';

            try {
                const response = await fetch('/api/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                if (response.ok) {
                    alert("¡Solicitud enviada correctamente! Nos contactaremos a la brevedad.");
                    contactForm.reset();
                } else {
                    alert("Hubo un error al enviar. Por favor intente de nuevo.");
                }
            } catch (err) {
                console.error(err);
                alert("Error de conexión al enviar el formulario.");
            } finally {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    // --- Chatbot Logic ---
    const chatToggle = document.getElementById('chatbot-toggle');
    const chatWindow = document.getElementById('chatbot-window');
    const chatClose = document.getElementById('chatbot-close');
    const chatMessages = document.getElementById('chatbot-messages');
    const chatInput = document.getElementById('chat-input');
    const chatSend = document.getElementById('chat-send');

    if(chatToggle && chatWindow) {
        chatToggle.addEventListener('click', () => {
            chatWindow.classList.toggle('hidden');
        });

        chatClose.addEventListener('click', () => {
            chatWindow.classList.add('hidden');
        });

        const appendMessage = (text, type) => {
            const msgDiv = document.createElement('div');
            msgDiv.className = type === 'user' ? 'user-msg fade-in-up is-visible' : 'bot-msg fade-in-up is-visible';
            msgDiv.innerHTML = `<p>${text}</p>`;
            chatMessages.appendChild(msgDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        };

        const handleChatMsg = async (text) => {
            if(!text.trim()) return;
            appendMessage(text, 'user');
            chatInput.value = '';
            
            // Add thinking indicator (optional)
            const thinkingId = 'thinking-' + Date.now();
            const msgDiv = document.createElement('div');
            msgDiv.id = thinkingId;
            msgDiv.className = 'bot-msg fade-in-up is-visible';
            msgDiv.innerHTML = `<p>...</p>`;
            chatMessages.appendChild(msgDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;

            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: text })
                });
                const data = await response.json();
                document.getElementById(thinkingId).remove();
                appendMessage(data.reply || "Lo siento, no entendí.", 'bot');
            } catch (err) {
                console.error(err);
                document.getElementById(thinkingId).remove();
                appendMessage("Ocurrió un error al contactar al asistente. Por favor, intenta más tarde.", 'bot');
            }
        };

        if(chatSend) chatSend.addEventListener('click', () => handleChatMsg(chatInput.value));
        if(chatInput) chatInput.addEventListener('keypress', (e) => {
            if(e.key === 'Enter') handleChatMsg(chatInput.value);
        });

        // Chips automation
        if(chatMessages) {
            chatMessages.addEventListener('click', (e) => {
                if(e.target.classList.contains('chat-chip')) {
                    const text = e.target.innerText;
                    e.target.parentElement.style.display = 'none';
                    handleChatMsg(text);
                }
            });
        }
    }
});
