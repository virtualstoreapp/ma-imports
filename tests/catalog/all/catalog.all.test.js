const {
  setupDesktop,
  setupMobile,
} = require('../../utils/catalogCommon');

const {
  assertAllProducts,
} = require('../../utils/catalogAsserts');

describe('Catalog', () => {
    describe('All', () => {
        describe('Desktop View', () => {
            beforeEach(async () => {
                await setupDesktop();
            });

            it('renders "All Products" correctly', async () => {
                await assertAllProducts();
            });
        });

        describe('Mobile View', () => {
            beforeEach(async () => {
                await setupMobile();
            });

            it('renders "All Products" correctly on mobile', async () => {
                await assertAllProducts();
            });
        });
    });  
});