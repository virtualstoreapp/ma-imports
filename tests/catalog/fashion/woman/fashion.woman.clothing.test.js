const {
  setupDesktop,
  setupMobile,
} = require('../../../utils/catalogCommon');

const {
  selectSweatshirtWoman,
  selectShortsJeansWoman,
  selectPantsJeansWoman,
  selectFitnessLeggingWoman,
  selectFitnessTopWoman,
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
                });

                describe('Fitness', () => {
                    it('renders final subcategory "Calças Legging Feminina" correctly on desktop', async () => {
                        await selectFitnessLeggingWoman();
                    });

                    it('renders final subcategory "Top Feminino" correctly on desktop', async () => {
                        await selectFitnessTopWoman();
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
                    it('renders final subcategory "Calças Jeans Feminina" correctly on desktop', async () => {
                        await selectPantsJeansWoman();
                    }); 
                });

                describe('Fitness', () => {
                    it('renders final subcategory "Calças Legging Feminina" correctly on desktop', async () => {
                        await selectFitnessLeggingWoman();
                    });

                    it('renders final subcategory "Top Feminino" correctly on desktop', async () => {
                        await selectFitnessTopWoman();
                    });
                });
            });
        });
    });
});
    