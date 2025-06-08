docker-down:
	docker compose down --remove-orphans

docker-build: docker-down
	docker compose build --no-cache

start-app-server:
	docker compose -f 'docker-compose.yml' up --build 'app-server'

test-app:
	docker compose -f 'docker-compose.yml' up --build 'test-app'

update-tests-snapshots:
	docker compose -f 'docker-compose.yml' up --build 'update-tests-snapshots'