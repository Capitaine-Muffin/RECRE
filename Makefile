# Regenerate every derived file from the raw .w3x maps.
.PHONY: all clean

all:
	sh tools/run_all.sh

clean:
	rm -rf data/maps data/rules data/scripts data/catalog assets/extracted docs/generated
