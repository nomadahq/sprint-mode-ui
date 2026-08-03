import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button, Spinner } from "../../dist/index.js";

describe("committed distribution", () => {
  it("exposes the current Spinner accessibility and sizing contract", () => {
    render(<Spinner size={16} label="Loading Hub" inline />);
    expect(screen.getByRole("status", { name: "Loading Hub" })).toHaveClass(
      "sm-spinner-wrap-inline",
    );
    expect(screen.getByRole("status", { name: "Loading Hub" }).firstElementChild).toHaveStyle({
      width: "16px",
      height: "16px",
    });
  });

  it("exposes native Button attributes and refs", () => {
    const ref = React.createRef();
    render(
      <Button ref={ref} aria-label="Create Hub space" data-surface="hub">
        Create
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Create Hub space" });
    expect(button).toHaveAttribute("data-surface", "hub");
    expect(ref.current).toBe(button);
  });
});
