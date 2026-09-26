-- Pre-provisions every worktree-offset database (offsets 0-7, see `make ports` in the root
-- Makefile) so a new worktree never needs a manual `createdb`. `engofy` (offset 0's dev DB) is
-- already created by the postgres image itself via POSTGRES_DB in compose.yaml.
--
-- Runs once, only when the postgres_data volume is first initialized (official postgres image
-- behavior for /docker-entrypoint-initdb.d) — an already-initialized volume needs
-- `make down-volumes && make up` to pick up a change made here.
CREATE DATABASE "engofy-testing";

CREATE DATABASE "engofy_wt1";
CREATE DATABASE "engofy-testing-wt1";

CREATE DATABASE "engofy_wt2";
CREATE DATABASE "engofy-testing-wt2";

CREATE DATABASE "engofy_wt3";
CREATE DATABASE "engofy-testing-wt3";

CREATE DATABASE "engofy_wt4";
CREATE DATABASE "engofy-testing-wt4";

CREATE DATABASE "engofy_wt5";
CREATE DATABASE "engofy-testing-wt5";

CREATE DATABASE "engofy_wt6";
CREATE DATABASE "engofy-testing-wt6";

CREATE DATABASE "engofy_wt7";
CREATE DATABASE "engofy-testing-wt7";
