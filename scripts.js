document.addEventListener('DOMContentLoaded', () => {
  // Cache DOM selectors
  const categoryButtons = document.querySelectorAll('nav button[data-category]');
  const productListContainer = document.getElementById('product-list');
  const categoryHeading = document.getElementById('category-heading');
  
  // Mobile menu elements
  const menuToggle = document.getElementById('menu-toggle');
  const nav = document.querySelector('nav');

  // Helper: Format numbers as Brazilian currency
  const formatCurrency = value =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  // Function to fetch data for a given category
  async function fetchCategoryData(category) {
    if (category === 'all') {
      // For the "all" category, fetch all JSON files and combine the results
      // const categories = ['shoes', 'electronics', 'clothing', 'home'];
      const categories = ['shoes'];
      try {
        const responses = await Promise.all(
          categories.map(c => fetch(`products/${c}.json`))
        );
        const jsonData = await Promise.all(
          responses.map(response => {
            if (!response.ok) {
              throw new Error(`Failed to fetch data for category ${category}`);
            }
            return response.json();
          })
        );
        return jsonData.flat();
      } catch (error) {
        console.error("Error fetching 'all' category data:", error);
        return [];
      }
    } else {
      // For a specific category, fetch the corresponding JSON file
      try {
        const response = await fetch(`products/${category}.json`);
        if (!response.ok) {
          throw new Error(`Failed to fetch data for category ${category}`);
        }
        return await response.json();
      } catch (error) {
        console.error(`Error fetching data for category ${category}:`, error);
        return [];
      }
    }
  }

  // Render products based on the selected category
  async function renderProducts(category) {
    // Clear current product list
    productListContainer.innerHTML = '';

    // Update heading based on category
    if (category === 'all') {
      categoryHeading.textContent = 'Todos os Produtos';
    } else {
      switch (category) {
        case 'shoes':
          categoryHeading.textContent = 'Calçados';
          break;
        // case 'electronics':
        //   categoryHeading.textContent = 'Eletrônicos';
        //   break;
        // case 'clothing':
        //   categoryHeading.textContent = 'Roupas';
        //   break;
        // case 'home':
        //   categoryHeading.textContent = 'Eletrodomésticos';
        //   break;
        default:
          categoryHeading.textContent = 'Produtos';
      }
    }

    // Fetch data for the selected category
    const data = await fetchCategoryData(category);
    data.forEach(product => {
      const li = document.createElement('li');
      li.classList.add('product-item');

      const priceHTML = product.oldPrice
        ? `<span class="old-price">${formatCurrency(product.oldPrice)}</span>
           <span class="new-price">${formatCurrency(product.price)}</span>`
        : `<span class="price">${formatCurrency(product.price)}</span>`;

      li.innerHTML = `
        <img src="${product.image}" alt="${product.name}">
        <div class="product-details">
          <h3>${product.name}</h3>
          ${
            product.size && product.size !== 'N/A'
              ? `<span class="size">Tamanho: ${product.size}</span>`
              : ''
          }
          ${priceHTML}
        </div>
      `;
      productListContainer.appendChild(li);
    });

    // Update the URL hash (for bookmarking or sharing)
    window.location.hash = category;
  }

  // Attach click events to each category button
  categoryButtons.forEach(button => {
    button.addEventListener('click', async () => {
      const category = button.getAttribute('data-category');
      await renderProducts(category);

      // Track the category selection as a custom event in GA4
      gtag('event', 'select_category', {
        event_category: 'Navigation',
        event_label: category,  // e.g., 'shoes', 'electronics', etc.
        value: 1              // Counts the selection; you can adjust as needed.
      });
      
      // If the mobile menu is open, close it after selecting a category
      if (nav.classList.contains('active')) {
        nav.classList.remove('active');
        menuToggle.setAttribute('aria-expanded', 'false');
      }
    });
  });

  // Mobile menu toggle event
  menuToggle.addEventListener('click', () => {
    nav.classList.toggle('active');
    const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!expanded));
  });

  // On page load, check the URL hash and render the corresponding category (default to "all")
  const initialCategory = window.location.hash.slice(1) || 'all';
  renderProducts(initialCategory);
});
