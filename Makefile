docker-down:
	docker compose down --remove-orphans

docker-build: docker-down
	docker compose build --no-cache

start-app-server: docker-down
	docker compose up --build app-server

test-app:
	docker compose run --rm --build test-app

update-tests-snapshots:
	docker compose run --rm --build update-tests-snapshots

build-app:
	docker compose run --rm --build build-app

preview: build-app
	docker compose up --build preview
