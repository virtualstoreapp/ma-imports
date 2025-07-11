const {
  setupDOM,
  setupDesktop,
  fireEvent,
  waitFor
} = require('../utils/catalogCommon');

describe('Catalog Behaviour', () => {
    beforeEach(async () => {
        await setupDesktop();
    });
    
    describe('Sorting Order', () => {
        const customData = {
            "shoes-man": [{ name: "[1202252201] Shoe Man", price: 149 }],
            "slippers-man": [{ name: "[1702251140] Slipper Man", price: 29.90 }],
            "tshirts-casual-man": [{ name: "[0103250820] Tshirt Casual Man", price: 89.90 }],
            "tshirts-dryfit-man": [{ name: "[2703251659] Tshirt Dryfit Man", price: 59.90 }],
            "tshirts-polo-man": [{ name: "[1603250851] Tshirt Polo Man", price: 59.90 }],
            "dress-shirts-man": [{ name: "[0806251831] Dress Shirt Man", price: 139.90 }],
            "tank-top-casual-man": [{ name: "[1903251705] Tank Top Casual Man", price: 39.90 }],
            "tank-top-dryfit-man": [{ name: "[0703251715] Tank Top Dryfit Man", price: 59.90 }],
            "shorts-sweatshorts-man": [{ name: "[2003250848] Short Basic Man", price: 69.90 }],
            "shorts-basic-man": [{ name: "[2103251150] Short Basic Man", price: 28.00 }],
            "shorts-jeans-man": [{ name: "[2603251652] Short Jeans Man", price: 79.90 }],
            "shorts-tactel-man": [{ name: "[0304251805] Short Tactel Man", price: 59.90 }],
            "caps-man": [{ name: "[0106250956] Cap Man", price: 59.90 }],
            "socks-man": [{ name: "[0106250834] Socks Man", price: 21.90 }],
            "sweatshirts-man": [{ name: "[0106250800] Sweatshirt Man", price: 299.00 }],
            "sweatshirts-woman": [{ name: "[0207251439] Sweatshirt Woman", price: 299.00 }],
            "pants-sweatpants-man": [{ name: "[0407251439] Sweatspants Man", price: 99.00 }],
            "pants-jeans-man": [{ name: "[0507251439] Jeans Man", price: 179.00 }],
            "sweatshirts-set-children": [{ name: "[1007251313] Sweatshirt Set Children", price: 199.00 }],
            "pants-legging-woman": [{ name: "[1107250717] Legging Woman", price: 89.00 }],
            "shorts-jeans-woman": [{ name: "[1107250718] Short Jeans Woman", price: 79.90 }],
            "pants-jeans-woman": [{ name: "[1107251409] Pants Jeans Woman", price: 89.90 }],
        };

        beforeEach(() => {
            // Reset modules and override fetch BEFORE initializing the catalog.
            jest.resetModules();
            global.fetch.mockImplementation((url) => {
                const match = url.match(/products\/(.*)\.json/);
                const category = match ? match[1] : null;

                if (category && customData.hasOwnProperty(category)) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve(customData[category])
                    });
                }
                return Promise.reject(new Error(`Unknown URL: ${url}`));
            });

            setupDOM();
        });

        it('sorts products in descending order based on date parsed from product names', async () => {
            await waitFor(() => {
                expect(document.getElementById('category-heading')).toHaveTextContent("Novidades");
            });

            await waitFor(() => {
                expect(document.querySelectorAll('#product-list .product-item').length).toBeGreaterThan(0);
            });

            const productItems = Array.from(document.querySelectorAll('#product-list .product-item'));
            const productNames = productItems.map(item => item.querySelector('h3').textContent);
            
            expect(productNames).toEqual([
                "[1107251409] Pants Jeans Woman",
                "[1107250718] Short Jeans Woman",
                "[1107250717] Legging Woman",
                "[1007251313] Sweatshirt Set Children",
                "[0507251439] Jeans Man",
                "[0407251439] Sweatspants Man",
                "[0207251439] Sweatshirt Woman",
                "[0806251831] Dress Shirt Man",
                "[0106250956] Cap Man",
                "[0106250834] Socks Man",
                "[0106250800] Sweatshirt Man",
                "[0304251805] Short Tactel Man",
                "[2703251659] Tshirt Dryfit Man",
                "[2603251652] Short Jeans Man",
                "[2103251150] Short Basic Man",
                "[2003250848] Short Basic Man",
                "[1903251705] Tank Top Casual Man",
                "[1603250851] Tshirt Polo Man",
                "[0703251715] Tank Top Dryfit Man",
                "[0103250820] Tshirt Casual Man",
                "[1702251140] Slipper Man",
                "[1202252201] Shoe Man"
            ]);
        });
    });

    describe('Sold Out Label', () => {
        beforeEach(() => {
            // Override fetch with custom data for sold-out product.
            const customSoldOutData = {
                "slippers-man": [
                    { name: "[1702251140] Tommy Hilfiger", price: 29.90, soldOut: true }
                ]
            };

            global.fetch.mockImplementation((url) => {
                const match = url.match(/products\/(.*)\.json/);
                const category = match ? match[1] : null;

                if (category && customSoldOutData.hasOwnProperty(category)) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve(customSoldOutData[category])
                    });
                }

                return Promise.reject(new Error(`Unknown URL: ${url}`));
            });

            setupDOM();
        });

        it('displays sold out label in product list item', async () => {
            const button = document.querySelector('nav button[data-category="slippers-man"]');
            fireEvent.click(button);

            await waitFor(() => {
                const productList = document.getElementById('product-list');
                expect(productList.children.length).toBeGreaterThan(0);
            });
            
            const productItem = document.querySelector('#product-list .product-item');
            const soldOutLabel = productItem.querySelector('.sold-out-label');

            expect(soldOutLabel).toBeInTheDocument();
            expect(soldOutLabel).toHaveTextContent("Esgotado");
        });

        it('displays sold out label in modal and disables "Comprar" button for sold out product', async () => {
            const button = document.querySelector('nav button[data-category="slippers-man"]');
            
            fireEvent.click(button);
            
            await waitFor(() => {
                const productList = document.getElementById('product-list');
                expect(productList.children.length).toBeGreaterThan(0);
            });
            
            const productItem = document.querySelector('#product-list .product-item');
            
            fireEvent.click(productItem);
            
            await waitFor(() => {
                const modal = document.getElementById('product-modal');
                expect(modal).toHaveStyle({ display: 'flex' });
            });
            
            const modalSoldOutLabel = document.querySelector('#modal-image-container .sold-out-label');
            
            expect(modalSoldOutLabel).toBeInTheDocument();
            expect(modalSoldOutLabel).toHaveTextContent("Esgotado");
            
            const buyButton = document.getElementById('buy-product');
            
            expect(buyButton).toBeDisabled();
        });
    });

    describe('Error Handling', () => {
        it('handles fetch errors gracefully', async () => {
            const btn = document.querySelector('nav button[data-category="all"]');

            btn.setAttribute('data-category', 'nonexistent');

            global.fetch.mockImplementationOnce(() =>
                Promise.resolve({ ok: false, statusText: 'Not Found' })
            );

            fireEvent.click(btn);

            await waitFor(() => {
                const list = document.getElementById('product-list');
                expect(list.children.length).toEqual(0);
            });
        });
    });
});