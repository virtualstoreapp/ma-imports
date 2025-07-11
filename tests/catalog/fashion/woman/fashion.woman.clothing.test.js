const {
  setupDesktop,
  setupMobile,
} = require('../../../utils/catalogCommon');

const {
  selectSweatshirtWoman,
  selectShortsJeansWoman,
  selectPantsJeansWoman,
  selectPantsLeggingWoman,
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

                describe('Shorts', () => {
                    it('renders final subcategory "Bermudas Jeans Feminina" correctly on desktop', async () => {
                        await selectShortsJeansWoman();
                    });
                });

                describe('Pants', () => {
                    it('renders final subcategory "Calças Jeans Feminina" correctly on desktop', async () => {
                        await selectPantsJeansWoman();
                    });

                    it('renders final subcategory "Calças Legging Feminina" correctly on desktop', async () => {
                        await selectPantsLeggingWoman();
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

                describe('Shorts', () => {
                    it('renders final subcategory "Bermudas Jeans Feminina" correctly on mobile', async () => {
                        await selectShortsJeansWoman();
                    });
                });

                describe('Pants', () => {
                    it('renders final subcategory "Calças Jeans Feminina" correctly on mobile', async () => {
                        await selectPantsJeansWoman();
                    });

                    it('renders final subcategory "Calças Legging Feminina" correctly on mobile', async () => {
                        await selectPantsLeggingWoman();
                    });
                });
            });
        });
    });
});
    