const products = {
    shoes: [
        { name: "Adidas Campus", price: 499.99, oldPrice: 599.99, image: "images/shoes/adidas/adidas-campus-marrom.jpeg", size: "37/38, 42" },
        { name: "Adidas Campus", price: 499.99, oldPrice: 599.99, image: "images/shoes/adidas/adidas-campus-preto.jpeg", size: "37" },
        { name: "Adidas Campus", price: 499.99, oldPrice: 599.99, image: "images/shoes/adidas/adidas-campus-vermelho.jpeg", size: "35" },
        { name: "Adidas Original", price: 499.99, image: "images/shoes/adidas/adidas-original-beje.jpeg", size: "35, 38, 40" },
        { name: "Nike", price: 499.99, image: "images/shoes/nike/nike-azul.jpeg", size: "35, 38, 40" },
        { name: "Nike", price: 499.99, image: "images/shoes/nike/nike-preto.jpeg", size: "35, 38, 40" },
        { name: "Nike", price: 499.99, image: "images/shoes/nike/nike-vermelho.jpeg", size: "35, 38, 40" },
        { name: "Vans", price: 499.99, image: "images/shoes/vans/vans.jpeg", size: "35, 38, 40" },
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

// Combine all products from different categories
const allProducts = [
    ...products.shoes,
    ...products.electronics,
    ...products.clothing,
    ...products.home
];

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function displayProducts(category) {
    const categorySection = document.getElementById(category);
    const productList = categorySection.querySelector('.product-list');
    productList.innerHTML = ""; // Clear previous products

    const productListData = category === 'all' ? allProducts : products[category];

    productListData.forEach(product => {
        const productItem = document.createElement('li');
        productItem.classList.add('product-item');

        let priceHTML = `<span class="price">${formatCurrency(product.price)}</span>`;

        if (product.oldPrice) {
            priceHTML = `
                <span class="old-price">${formatCurrency(product.oldPrice)}</span>
                <span class="new-price">${formatCurrency(product.price)}</span>
            `;
        }

        productItem.innerHTML = `
            <img src="${product.image}" alt="${product.name}" />
            <div class="product-details">
                <h3>${product.name}</h3>
                <span class="size">${product.size !== "N/A" ? `Tamanho: ${product.size}` : ''}</span>
                ${priceHTML}
            </div>
        `;
        
        productList.appendChild(productItem);
    });

    // Hide all sections and display the selected category
    document.querySelectorAll('section').forEach(section => {
        section.style.display = 'none';
    });

    categorySection.style.display = 'block';
}

// Toggle menu visibility on mobile
const menuToggle = document.getElementById('menu-toggle');
const nav = document.querySelector('nav');

menuToggle.addEventListener('click', () => {
    nav.classList.toggle('active');
});

document.addEventListener('DOMContentLoaded', () => {
    // Initially show the "Início" category
    showCategory('all');
});

function showCategory(category) {
    displayProducts(category);
}
