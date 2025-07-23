(function () {
  // Prevent reinitialization (except in test mode)
  if (window.__catalogInitialized && !window.__isTest) return;
  window.__catalogInitialized = true;

  // --- Constants ---
  const WHATSAPP_NUMBER = '5519999762594';
  const CATEGORIES_DICT = {
    'sweatshirts-woman': 'Blusas Feminina',
    'sweatshirts-man': 'Blusas Masculina',
    'shorts-basic-man': 'Bermudas Básica Masculina',
    'shorts-jeans-woman': 'Bermudas Jeans Feminina',
    'shorts-jeans-man': 'Bermudas Jeans Masculina',
    'shorts-sweatshorts-man': 'Bermudas Moletom Masculina',
    'shorts-tactel-man': 'Bermudas Tactel Masculina',
    'caps-man': 'Bonés Masculino',
    'tshirts-casual-man': 'Camisetas Casuais Masculina',
    'tshirts-dryfit-man': 'Camisetas Dry Fit Masculina',
    'belts-man': 'Cintos Masculino',
    'tshirts-polo-man': 'Camisetas Polo Masculina',
    'dress-shirts-man': 'Camisetas Sociais Masculina',
    'wallets-man': 'Carteiras Masculina',
    'pants-sweatpants-man': 'Calças Moletom Masculina',
    'pants-jeans-woman': 'Calças Jeans Feminina',
    'pants-jeans-man': 'Calças Jeans Masculina',
    'pants-legging-woman': 'Calças Legging Feminina',
    'slippers-man': 'Chinelos',
    'sweatshirts-set-children': 'Conjuntos Moletom Infantil',
    'socks-man': 'Meias Masculina',
    all: 'Novidades',
    'tank-top-casual-man': 'Regatas Casuais Masculina',
    'tank-top-dryfit-man': 'Regatas Dry Fit Masculina',
    'shoes-man': 'Tênis',
  }

  // --- Helper Functions ---
  const formatCurrency = (value) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);

  const updateCategoryHeading = (category, headingEl) => {
    headingEl.textContent = CATEGORIES_DICT[category] || 'Produtos';
  };

  const collapseAllSubmenus = () => {
    document.querySelectorAll('nav button.has-submenu, nav li.has-submenu > button')
      .forEach((button) => {
        button.setAttribute('aria-expanded', 'false');
        const submenu = button.nextElementSibling;
        if (submenu && submenu.classList.contains('submenu')) {
          if (window.innerWidth <= 768) {
            submenu.classList.remove('open');
          } else {
            submenu.style.display = 'none';
          }
        }
      });
  };

  // --- Modal Module ---
  const Modal = (() => {
    let modal, currentImages = [], currentIndex = 0, currentZoom = 1;
    let currentProductName = '', currentCategory = '';

    // Build modal HTML markup.
    const createModalMarkup = () => `
      <div id="modal-content">
        <button id="modal-close">X</button>
        <div id="modal-image-container" class="modal-image-container">
          <img id="modal-image" src="" alt="">
        </div>
        <div id="modal-controls">
          <button id="prev-image">&lt;</button>
          <button id="zoom-out">-</button>
          <button id="copy-product-id">ID</button>
          <button id="zoom-in">+</button>
          <button id="next-image">&gt;</button>
          <button id="buy-product">Comprar</button>
        </div>
      </div>
    `;

    // Bind modal event handlers.
    const bindModalEvents = () => {
      document.getElementById('modal-close').addEventListener('click', close);
      document.getElementById('prev-image').addEventListener('click', showPrev);
      document.getElementById('next-image').addEventListener('click', showNext);
      document.getElementById('zoom-in').addEventListener('click', () => adjustZoom(0.2));
      document.getElementById('zoom-out').addEventListener('click', () => adjustZoom(-0.2));

      document.getElementById('copy-product-id').addEventListener('click', () => {
        if (currentProductName) {
          const message = `Categoria: ${currentCategory}, ID do Produto: ${currentProductName}`;
          navigator.clipboard.writeText(message)
            .then(() => {
              alert('ID copiado!');
            })
            .catch(err => {
              console.error('Falha ao copiar o ID:', err);
              alert('Erro ao copiar. Tente novamente.');
            });
        }
      });

      document.getElementById('buy-product').addEventListener('click', () => {
        const message = `Olá, acabei de conferir seu catálogo online e na categoria ${currentCategory}, me interessei pelo produto ${currentProductName}. Poderia, por favor, me enviar mais informações e confirmar a disponibilidade? Obrigado!`;
        const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
        if (window.gtag) {
          gtag('event', 'buy_product', {
            event_category: 'Modal',
            event_label: currentProductName,
            product_category: currentCategory,
          });
        }
        window.open(url, '_blank');
      });
      modal.addEventListener('click', (event) => {
        if (event.target === modal) close();
      });
    };

    const updateImage = () => {
      const modalImage = document.getElementById('modal-image');
      modalImage.src = currentImages[currentIndex];
      modalImage.style.transform = `scale(${currentZoom})`;
    };

    const updateNavButtons = () => {
      const prevBtn = document.getElementById('prev-image');
      const nextBtn = document.getElementById('next-image');
      const disableNav = currentImages.length < 2;
      prevBtn.disabled = disableNav;
      nextBtn.disabled = disableNav;
    };

    // Open modal with product data. Applies soldOut logic.
    const open = (product, categoryText) => {
      currentImages = Array.isArray(product.images) ? product.images : [product.image];
      currentIndex = 0;
      currentZoom = 1;
      currentProductName = product.name;
      currentCategory = categoryText;
      updateImage();
      updateNavButtons();

      // Default soldOut to false if not provided.
      const isSoldOut = product.hasOwnProperty('soldOut') ? product.soldOut : false;
      const buyButton = document.getElementById('buy-product');
      const modalImageContainer = document.getElementById('modal-image-container');

      // Remove previous sold-out label if it exists.
      const existingLabel = modalImageContainer.querySelector('.sold-out-label');
      if (existingLabel) existingLabel.remove();

      if (isSoldOut) {
        const label = document.createElement('div');
        label.id = 'sold-out-label';
        label.className = 'sold-out-label';
        label.textContent = 'Esgotado';
        modalImageContainer.appendChild(label);
        buyButton.disabled = true;
      } else {
        buyButton.disabled = false;
      }

      modal.style.display = 'flex';
      if (window.gtag) {
        gtag('event', 'open_modal', {
          event_category: 'Product',
          event_label: currentProductName,
        });
      }
    };

    const close = () => {
      modal.style.display = 'none';
    };

    const showPrev = () => {
      if (currentImages.length > 1) {
        currentIndex = (currentIndex - 1 + currentImages.length) % currentImages.length;
        currentZoom = 1;
        updateImage();
        if (window.gtag) {
          gtag('event', 'navigate_image', {
            event_category: 'Modal',
            event_label: 'prev',
            product: currentProductName,
          });
        }
      }
    };

    const showNext = () => {
      if (currentImages.length > 1) {
        currentIndex = (currentIndex + 1) % currentImages.length;
        currentZoom = 1;
        updateImage();
        if (window.gtag) {
          gtag('event', 'navigate_image', {
            event_category: 'Modal',
            event_label: 'next',
            product: currentProductName,
          });
        }
      }
    };

    const adjustZoom = (delta) => {
      currentZoom = Math.max(0.2, currentZoom + delta);
      updateImage();
      if (window.gtag) {
        const action = delta > 0 ? 'zoom_in' : 'zoom_out';
        gtag('event', action, {
          event_category: 'Modal',
          event_label: currentProductName,
          zoom: currentZoom,
        });
      }
    };

    const init = () => {
      modal = document.createElement('div');
      modal.id = 'product-modal';
      modal.innerHTML = createModalMarkup();
      document.body.appendChild(modal);
      bindModalEvents();
    };

    return { init, open, close };
  })();

  // --- Catalog Module ---
  const Catalog = (() => {
    const categoryButtons = document.querySelectorAll('nav button[data-category]');
    const productListContainer = document.getElementById('product-list');
    const categoryHeading = document.getElementById('category-heading');

    // Parse date from product name using a 10-digit code.
    const parseProductDate = (name) => {
      const regex = /\[(\d{10})\]/;
      const match = name ? name.match(regex) : null;
      if (match) {
        const code = match[1];
        const day = parseInt(code.substring(0, 2), 10);
        const month = parseInt(code.substring(2, 4), 10) - 1;
        const year = parseInt(code.substring(4, 6), 10) + 2000;
        const hour = parseInt(code.substring(6, 8), 10);
        const minute = parseInt(code.substring(8, 10), 10);
        return new Date(year, month, day, hour, minute);
      }
      return new Date(0);
    };

    // Fetch product data for a given category.
    const fetchCategoryData = async (category) => {
      try {
        if (category === 'all') {
          const categories = Object.keys(CATEGORIES_DICT).filter(key => key !== 'all');
          const responses = await Promise.all(
            categories.map(cat => fetch(`products/${cat}.json`))
          );
          const jsonData = await Promise.all(
            responses.map(async (response, idx) => {
              if (!response.ok) throw new Error(`Failed to fetch data for ${categories[idx]}`);
              return response.json();
            })
          );
          const products = jsonData.flat();
          const sortedProducts = products.sort((a, b) => parseProductDate(b.name) - parseProductDate(a.name));
          return sortedProducts;
        } else {
          const response = await fetch(`products/${category}.json`);
          if (!response.ok) throw new Error(`Failed to fetch data for ${category}`);
          return response.json();
        }
      } catch (error) {
        console.error(`Error fetching data for ${category}:`, error);
        return [];
      }
    };

    // Render product items based on selected category.
    const renderProducts = async (category) => {
      productListContainer.innerHTML = '';
      updateCategoryHeading(category, categoryHeading);
      const products = await fetchCategoryData(category);
      products.forEach((product) => {
        const li = document.createElement('li');
        li.classList.add('product-item');
        li.style.position = 'relative'; // For sold-out label positioning

        const priceHTML = product.oldPrice && product.oldPrice > 0
          ? `<span class="old-price">${formatCurrency(product.oldPrice)}</span>
             <span class="new-price">${formatCurrency(product.price)}</span>`
          : `<span class="price">${formatCurrency(product.price)}</span>`;

        const imgSrc = Array.isArray(product.images) ? product.images[0] : product.image;

        li.innerHTML = `
          <img src="${imgSrc}" alt="${product.name}">
          <div class="product-details">
            <h3>${product.name}</h3>
            ${product.description ? `<p class="description">${product.description}</p>` : ''}
            ${product.size && product.size !== 'N/A' ? `<span class="size">Tamanho: ${product.size}</span>` : ''}
            ${priceHTML}
          </div>
        `;

        // Add sold-out label if the product is sold out (default false).
        const isSoldOut = product.hasOwnProperty('soldOut') ? product.soldOut : false;
        if (isSoldOut) {
          const label = document.createElement('div');
          label.className = 'sold-out-label';
          label.textContent = 'Esgotado';
          li.appendChild(label);
        }

        li.addEventListener('click', () => {
          if (window.gtag) {
            gtag('event', 'product_click', {
              event_category: 'Product',
              event_label: product.name,
            });
          }
          Modal.open(product, categoryHeading.textContent);
        });

        productListContainer.appendChild(li);
      });
      window.location.hash = category;
    };

    // Bind click events for category buttons.
    const bindCategoryButtons = () => {
      categoryButtons.forEach((button) => {
        button.addEventListener('click', async (event) => {
          event.stopPropagation();
          const submenu = button.nextElementSibling;
          const hasSubmenu = button.classList.contains('has-submenu') ||
                              (button.parentElement && button.parentElement.classList.contains('has-submenu'));
          if (hasSubmenu && submenu && submenu.classList.contains('submenu')) {
            const expanded = button.getAttribute('aria-expanded') === 'true';
            if (window.innerWidth <= 768) {
              button.setAttribute('aria-expanded', String(!expanded));
              submenu.classList.toggle('open', !expanded);
            } else {
              button.setAttribute('aria-expanded', String(!expanded));
              submenu.style.display = expanded ? 'none' : 'block';
            }
            return;
          }
          const category = button.getAttribute('data-category');
          await renderProducts(category);
          if (window.gtag) {
            gtag('event', 'select_category', {
              event_category: 'Navigation',
              event_label: category,
              value: 1,
            });
          }
          const nav = document.querySelector('nav');
          const menuToggle = document.getElementById('menu-toggle');
          if (nav.classList.contains('active')) {
            nav.classList.remove('active');
            menuToggle.setAttribute('aria-expanded', 'false');
          }
          collapseAllSubmenus();
        });
      });
    };

    const init = async () => {
      bindCategoryButtons();
      const initialCategory = window.location.hash.slice(1) || 'all';
      await renderProducts(initialCategory);
    };

    return { init };
  })();

  // --- Setup ---
  const setupCatalog = () => {
    Modal.init();
    Catalog.init();
  };

  // --- Mobile Menu Toggle ---
  document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menu-toggle');
    const nav = document.querySelector('nav');
    menuToggle.addEventListener('click', () => {
      nav.classList.toggle('active');
      const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
      menuToggle.setAttribute('aria-expanded', String(!expanded));
    });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupCatalog);
  } else {
    setupCatalog();
  }
})();
