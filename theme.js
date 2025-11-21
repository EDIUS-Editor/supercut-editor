// theme.js

document.addEventListener('DOMContentLoaded', () => {
    const themeToggleButton = document.getElementById('theme-toggle');
    const lightIcon = document.getElementById('theme-icon-light');
    const darkIcon = document.getElementById('theme-icon-dark');
    
    // Function to apply the theme
    const applyTheme = (theme) => {
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            lightIcon.style.display = 'none';
            darkIcon.style.display = 'block';
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            lightIcon.style.display = 'block';
            darkIcon.style.display = 'none';
        }
    };

    // Function to determine and set the initial theme
    const setInitialTheme = () => {
        // 1. Check for a saved preference in localStorage
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            applyTheme(savedTheme);
            return;
        }

        // 2. If no saved preference, check system preference
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        applyTheme(prefersDark ? 'dark' : 'light');
    };

    // Event listener for the toggle button
    themeToggleButton.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        // Apply the new theme and save it to localStorage
        applyTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    });

    // Set the theme when the page loads
    setInitialTheme();
});