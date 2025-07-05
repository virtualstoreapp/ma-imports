const {
  setupDesktop,
  setupMobile,
} = require('../../../utils/catalogCommon');

const {
  selectCapsMan,
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
                });
            });
        });
    });
});
    