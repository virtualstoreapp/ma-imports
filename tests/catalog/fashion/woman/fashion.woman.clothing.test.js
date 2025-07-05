const {
  setupDesktop,
  setupMobile,
} = require('../../../utils/catalogCommon');

const {
  selectSweatshirtWoman,
} = require('../../../utils/catalogActions');

describe('Fashion', () => {
    describe('Woman', () => {
        describe('Clothing', () => {

            describe('Desktop View', () => {
                beforeEach(async () => {
                    await setupDesktop();
                });

                describe('Sweatshirts', () => {
                    it('renders final subcategory "Blusas Feminina" correctly on desktop', async () => {
                        await selectSweatshirtWoman();
                    });
                });
            });

            describe('Mobile View', () => {
                beforeEach(async () => {
                    await setupMobile();
                });

                describe('Sweatshirts', () => {
                    it('renders final subcategory "Blusas Feminina" correctly on mobile', async () => {
                        await selectSweatshirtWoman();
                    });
                });
            });
        });
    });
});
    