build-DocumentStatusFunction:
	cd /media/tv_record/poc-rag && GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o $(ARTIFACTS_DIR)/bootstrap ./cmd/status

.PHONY: build-DocumentStatusFunction