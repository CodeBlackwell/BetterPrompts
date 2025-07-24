package config

import (
	"os"

	"github.com/betterprompts/technique-selector/internal/models"
	"gopkg.in/yaml.v3"
)

// LoadConfig loads the rules configuration from a YAML file
func LoadConfig(path string) (*models.RulesConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var config models.RulesConfig
	err = yaml.Unmarshal(data, &config)
	if err != nil {
		return nil, err
	}

	return &config, nil
}