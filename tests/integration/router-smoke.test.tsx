import { describe, it, expect } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";

describe("react-router memory smoke", () => {
  it("renders routed content under MemoryRouter + jsdom", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <p data-testid="smoke">router-ok</p>
      </MemoryRouter>
    );
    expect(screen.getByTestId("smoke")).toHaveTextContent("router-ok");
  });
});
