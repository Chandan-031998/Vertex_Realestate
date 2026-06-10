/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class", '[data-theme-mode="dark"]'],
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "Poppins", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        surface: {
          50: "#f8fafc",
          100: "#f1f5f9",
          900: "#0b1020",
        },
        brand: {
          blue: "#3b82f6",
          violet: "#8b5cf6",
          teal: "#14b8a6",
        },
      },
      boxShadow: {
        glass: "0 10px 35px rgba(18, 34, 74, 0.16)",
        glow: "0 0 0 1px rgba(99, 102, 241, 0.16), 0 12px 40px rgba(59, 130, 246, 0.25)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 45%, #14b8a6 100%)",
        "mesh-gradient": "radial-gradient(at 20% 10%, rgba(59,130,246,0.25) 0px, transparent 45%), radial-gradient(at 80% 0%, rgba(139,92,246,0.24) 0px, transparent 50%), radial-gradient(at 80% 80%, rgba(20,184,166,0.18) 0px, transparent 50%), radial-gradient(at 10% 90%, rgba(56,189,248,0.14) 0px, transparent 50%)",
      },
      keyframes: {
        fadeSlideIn: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        liftIn: {
          "0%": { opacity: "0", transform: "translateY(12px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        toastIn: {
          "0%": { opacity: "0", transform: "translateX(30px) scale(0.96)" },
          "70%": { opacity: "1", transform: "translateX(-4px) scale(1.01)" },
          "100%": { opacity: "1", transform: "translateX(0) scale(1)" },
        },
        modalIn: {
          "0%": { opacity: "0", transform: "scale(0.96) translateY(8px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
      },
      animation: {
        "fade-slide": "fadeSlideIn 260ms ease-out",
        "lift-in": "liftIn 260ms ease-out",
        "toast-in": "toastIn 320ms ease-out",
        "modal-in": "modalIn 240ms ease-out",
      },
    },
  },
  plugins: [],
};
