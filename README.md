[![Run Tests](https://github.com/virtualstoreapp/ma-imports/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/virtualstoreapp/ma-imports/actions/workflows/test.yml) [![Deploy GitHub Pages](https://github.com/virtualstoreapp/ma-imports/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/virtualstoreapp/ma-imports/actions/workflows/deploy.yml) [![pages-build-deployment](https://github.com/virtualstoreapp/ma-imports/actions/workflows/pages/pages-build-deployment/badge.svg?branch=main)](https://github.com/virtualstoreapp/ma-imports/actions/workflows/pages/pages-build-deployment)

https://virtualstoreapp.github.io/ma-imports/

docker compose down --remove-orphans
docker compose build --no-cache
docker compose run --rm app-server
docker compose run --rm -it test-app
docker compose run --rm -it update-tests-snapshots