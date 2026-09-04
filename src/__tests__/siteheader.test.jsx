import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SiteHeader } from "../SiteHeader.tsx";
import { formatPageTitle, siteThemeSnippet } from "../site-helpers.ts";

// jsdom in this setup does not provide localStorage; install a minimal stub so
// the sm-theme storage contract can be exercised the way the browser runs it.
function installLocalStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

const CAPITAL = {
  subdomain: "capital",
  name: "Capital",
  brand_color: "#1fac6a",
  brand_tint: "#e8f6f0",
  logo_mark_url: "https://api.sprintmode.ai/portals/capital/logo_mark.png",
  logo_horizontal_url: "https://api.sprintmode.ai/portals/capital/logo_horizontal.png",
  logo_dark_url: "https://api.sprintmode.ai/portals/capital/logo_horizontal_dark.png",
};

beforeEach(() => {
  installLocalStorage();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.style.removeProperty("--accent");
  document.documentElement.style.removeProperty("--accent-10");
});

describe("SiteHeader (logged-out marketing shell)", () => {
  it("renders the themed wordmark image and the 'by Sprint Mode' lockup", () => {
    render(<SiteHeader subdomain="capital" config={CAPITAL} />);
    const logo = screen.getByRole("img", { name: "Capital" });
    expect(logo).toHaveAttribute("src", CAPITAL.logo_horizontal_url);
    expect(screen.getByText("by Sprint Mode")).toBeInTheDocument();
  });

  it("falls back to the portal name as text when subdomain resolves no logo", () => {
    render(<SiteHeader subdomain="" config={{ name: "Capital" }} />);
    expect(screen.getByText("Capital")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("applies brand tokens from config to :root", () => {
    render(<SiteHeader subdomain="capital" config={CAPITAL} />);
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("#1fac6a");
    expect(document.documentElement.style.getPropertyValue("--accent-10")).toBe("#e8f6f0");
  });

  it("renders nav links and the sign-in entry", () => {
    render(
      <SiteHeader
        subdomain="capital"
        config={CAPITAL}
        navLinks={[{ label: "Methodology", href: "/methodology" }]}
        signInHref="https://capital.sprintmode.ai"
      />,
    );
    expect(screen.getByRole("link", { name: "Methodology" })).toHaveAttribute("href", "/methodology");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "https://capital.sprintmode.ai",
    );
  });

  it("theme pill cycles auto -> dark -> light using the sm-theme contract", () => {
    render(<SiteHeader subdomain="capital" config={CAPITAL} />);
    const pill = screen.getByRole("button", { name: /Theme:/ });

    // default = auto: no stored key, concrete data-theme applied
    expect(screen.getByText("Auto")).toBeInTheDocument();
    expect(localStorage.getItem("sm-theme")).toBeNull();

    fireEvent.click(pill);
    expect(screen.getByText("Dark")).toBeInTheDocument();
    expect(localStorage.getItem("sm-theme")).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    fireEvent.click(pill);
    expect(screen.getByText("Light")).toBeInTheDocument();
    expect(localStorage.getItem("sm-theme")).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    fireEvent.click(pill);
    expect(screen.getByText("Auto")).toBeInTheDocument();
    expect(localStorage.getItem("sm-theme")).toBeNull();
  });

  it("hides the sign-in entry when no href is given", () => {
    render(<SiteHeader subdomain="capital" config={CAPITAL} />);
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
  });

  it("formatPageTitle composes '<page> -- <site>' and bare site on home", () => {
    expect(formatPageTitle("Methodology", "Capital")).toBe("Methodology — Capital");
    expect(formatPageTitle(null, "Capital")).toBe("Capital");
  });

  it("no-FOUC snippet reads the sm-theme key and sets data-theme", () => {
    expect(siteThemeSnippet).toContain("sm-theme");
    expect(siteThemeSnippet).toContain("data-theme");
  });

  it("uses light wordmark when sm-theme='light', even when OS prefers dark", () => {
    // Simulate OS dark preference via matchMedia — the <source media> bug caused
    // this to override the explicit stored theme before the picture element was removed.
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query) => ({
        matches: query === "(prefers-color-scheme: dark)",
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    });
    localStorage.setItem("sm-theme", "light");
    render(<SiteHeader subdomain="capital" config={CAPITAL} />);
    const logo = screen.getByRole("img", { name: "Capital" });
    // Must be the light URL despite OS dark preference.
    expect(logo).toHaveAttribute("src", CAPITAL.logo_horizontal_url);
    // No <source> element may override the explicit theme choice.
    expect(document.querySelector("source")).toBeNull();
  });

  it("uses dark wordmark when sm-theme='dark' is stored", () => {
    localStorage.setItem("sm-theme", "dark");
    render(<SiteHeader subdomain="capital" config={CAPITAL} />);
    const logo = screen.getByRole("img", { name: "Capital" });
    expect(logo).toHaveAttribute("src", CAPITAL.logo_dark_url);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});
