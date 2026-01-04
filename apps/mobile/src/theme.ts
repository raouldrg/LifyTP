export const theme = {
    colors: {
        background: "#FDFBF7", // Cream/Off-white
        surface: "#FFFFFF",
        error: "#FF3B30",
        text: {
            primary: "#1A1A1A",
            secondary: "#666666",
            light: "#FFFFFF",
        },
        primary: "#1A1A1A", // Brand Black
        accent: "#FFA07A", // Peach/Orange
        border: "#E0E0E0",
        calendar: {
            green: "#C1E1C1",
            red: "#FF6B6B",
            beige: "#E8D5B5",
            blue: "#A0C4FF",
            grey: "#D3D3D3",
        },
    },
    spacing: {
        xs: 4,
        s: 8,
        m: 16,
        l: 24,
        xl: 32,
    },
    borderRadius: {
        s: 8,
        m: 16,
        l: 24,
        xl: 32,
        round: 9999,
    },
    typography: {
        h1: { fontSize: 32, fontWeight: "700" as const },
        h2: { fontSize: 24, fontWeight: "600" as const },
        h3: { fontSize: 20, fontWeight: "600" as const },
        body: { fontSize: 16, fontWeight: "400" as const },
        caption: { fontSize: 14, fontWeight: "400" as const },
        button: { fontSize: 16, fontWeight: "600" as const },
        // Unified page title style (Messages, Recherche, etc.)
        pageTitle: { fontSize: 28, fontWeight: "700" as const, letterSpacing: -0.5 },
    },
    // Header layout constants for pixel-perfect consistency
    header: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        searchBarMarginBottom: 12,
        actionButtonSize: 40,
    },
};
