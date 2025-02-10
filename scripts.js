document.addEventListener('DOMContentLoaded', () => {
    // Cache DOM selectors
    const categoryButtons = document.querySelectorAll('nav button[data-category]');
    const productListContainer = document.getElementById('product-list');
    const categoryHeading = document.getElementById('category-heading');
    
    // Mobile menu elements
    const menuToggle = document.getElementById('menu-toggle');
    const nav = document.querySelector('nav');
  
    // Products data
    const products = {
      shoes: [
        { name: "Adidas Campus", price: 499.99, oldPrice: 599.99, image: "images/shoes/adidas/adidas-campus-marrom.jpeg", size: "37/38, 42" },
        { name: "Adidas Campus", price: 499.99, oldPrice: 599.99, image: "images/shoes/adidas/adidas-campus-preto.jpeg", size: "37" },
        { name: "Adidas Campus", price: 499.99, oldPrice: 599.99, image: "images/shoes/adidas/adidas-campus-vermelho.jpeg", size: "35" },
        { name: "Adidas Original", price: 499.99, image: "images/shoes/adidas/adidas-original-beje.jpeg", size: "35, 38, 40" },
        { name: "Nike", price: 499.99, image: "images/shoes/nike/nike-azul.jpeg", size: "35, 38, 40" },
        { name: "Nike", price: 499.99, image: "images/shoes/nike/nike-preto.jpeg", size: "35, 38, 40" },
        { name: "Nike", price: 499.99, image: "images/shoes/nike/nike-vermelho.jpeg", size: "35, 38, 40" },
        { name: "Vans", price: 499.99, image: "images/shoes/vans/vans.jpeg", size: "35, 38, 40" }
      ],
      electronics: [
        { name: "Smartphone", price: 499.99, oldPrice: 599.99, image: "images/circle.png", size: "N/A" },
        { name: "Laptop", price: 899.99, image: "images/circle.png", size: "N/A" },
        { name: "Headphones", price: 69.99, image: "images/circle.png", size: "N/A" },
        { name: "Tablet", price: 299.99, oldPrice: 349.99, image: "images/circle.png", size: "N/A" }
      ],
      clothing: [
        { name: "Camiseta", price: 19.99, image: "images/item.jpeg", size: "P, M, G" },
        { name: "Calça Jeans", price: 49.99, oldPrice: 59.99, image: "images/item.jpeg", size: "M, G" },
        { name: "Jaqueta", price: 89.99, image: "images/item.jpeg", size: "P, M, G, GG" },
        { name: "Shorts", price: 25.99, image: "images/item.jpeg", size: "M" }
      ],
      home: [
        { name: "Aspirador de Pó", price: 129.99, oldPrice: 159.99, image: "images/circle.png", size: "N/A" },
        { name: "Micro-ondas", price: 79.99, image: "images/circle.png", size: "N/A" },
        { name: "Liquidificador", price: 39.99, image: "images/circle.png", size: "N/A" },
        { name: "Cafeteira", price: 59.99, image: "images/circle.png", size: "N/A" }
      ]
    };
  
    // Combine all products for the "all" category
    const allProducts = [
      ...products.shoes,
      ...products.electronics,
      ...products.clothing,
      ...products.home
    ];
  
    // Helper function to format numbers as Brazilian currency
    const formatCurrency = value =>
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  
    // Render products based on the selected category
    function renderProducts(category) {
      // Clear current product list
      productListContainer.innerHTML = '';
      let data;
      if (category === 'all') {
        data = allProducts;
        categoryHeading.textContent = 'Todos os Produtos';
      } else {
        data = products[category];
        // Update heading based on category
        switch (category) {
          case 'shoes':
            categoryHeading.textContent = 'Calçados';
            break;
          case 'electronics':
            categoryHeading.textContent = 'Eletrônicos';
            break;
          case 'clothing':
            categoryHeading.textContent = 'Roupas';
            break;
          case 'home':
            categoryHeading.textContent = 'Eletrodomésticos';
            break;
          default:
            categoryHeading.textContent = 'Produtos';
        }
      }
      // Create and append each product
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
            ${product.size !== 'N/A' ? `<span class="size">Tamanho: ${product.size}</span>` : ''}
            ${priceHTML}
          </div>
        `;
        productListContainer.appendChild(li);
      });
      // Update URL hash
      window.location.hash = category;
    }
  
    // Attach click events to each category button
    categoryButtons.forEach(button => {
      button.addEventListener('click', () => {
        const category = button.getAttribute('data-category');
        renderProducts(category);
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
  