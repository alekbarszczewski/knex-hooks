#!/bin/bash

npm version "$1" && npm publish && git push --tags
