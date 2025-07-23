const {
  setupDesktop,
  setupMobile,
} = require('../../../utils/catalogCommon');

const {
  selectCapsMan,
  selectBeltsMan,
} = require('../../../utils/catalogActions');

describe('Fashion', () => {
    describe('Man', () => {
        describe('Shoes', () => {

            describe('Desktop View', () => {
                beforeEach(async () => {
                    await setupDesktop();
                });

                describe('Accessories', () => {
                    it('renders final subcategory "Bonés Masculino" correctly on desktop', async () => {
                        await selectCapsMan();
                    });

                    it('renders final subcategory "Cintos Masculino" correctly on desktop', async () => {
                        await selectBeltsMan();
                    });
                });
            });

            describe('Mobile View', () => {
                beforeEach(async () => {
                    await setupMobile();
                });

                describe('Accessories', () => {
                    it('renders final subcategory "Bonés Masculino" correctly on mobile', async () => {
                        await selectCapsMan();
                    });

                    it('renders final subcategory "Cintos Masculino" correctly on mobile', async () => {
                        await selectBeltsMan();
                    });
                });
            });
        });
    });
});
    