package main

import (
    "fmt"
    "golang.org/x/crypto/bcrypt"
)

func main() {
    passwords := map[string]string{
        "demo":     "DemoPass123!",
        "admin":    "AdminPass123!",
        "testuser": "TestPass123!",
    }
    
    for user, password := range passwords {
        hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
        if err != nil {
            fmt.Printf("Error hashing password for %s: %v\n", user, err)
            continue
        }
        fmt.Printf("-- %s / %s\n", user, password)
        fmt.Printf("'%s',\n\n", string(hash))
    }
}