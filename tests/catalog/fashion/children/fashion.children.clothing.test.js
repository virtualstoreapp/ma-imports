const {
  setupDesktop,
  setupMobile,
} = require('../../../utils/catalogCommon');

const {
  selectSweatshirtSetChildren,
} = require('../../../utils/catalogActions');

describe('Fashion', () => {
    describe('Children', () => {
        describe('Clothing', () => {

            describe('Desktop View', () => {
                beforeEach(async () => {
                    await setupDesktop();
                });

                describe('Sweatshirts Set', () => {
                    it('renders final subcategory "Conjuntos Moletom Infantil" correctly on desktop', async () => {
                        await selectSweatshirtSetChildren();
                    });
                });

            });

            describe('Mobile View', () => {
                beforeEach(async () => {
                    await setupMobile();
                });

                describe('Sweatshirts Set', () => {
                    it('renders final subcategory "Conjuntos Moletom Infantil" correctly on mobile', async () => {
                        await selectSweatshirtSetChildren();
                    });
                });
            });
        });
    });
});