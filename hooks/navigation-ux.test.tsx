// @vitest-environment happy-dom
import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/tv-series/123" }));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
}));
vi.mock("@/components/theme/theme-toggle", () => ({ ThemeToggle: () => null }));
vi.mock("@/components/layout/user-menu", () => ({ UserMenu: () => null }));
import { Navbar } from "@/components/layout/navbar";

test("mobile menu contains focus, closes on Escape, and restores the trigger", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  try {
    await act(() => root.render(<Navbar />));
    expect(document.querySelector('[aria-label="Mobile navigation"]')).toBeNull();
    const trigger = container.querySelector<HTMLButtonElement>('[aria-haspopup="dialog"]')!;
    await act(() => { trigger.focus(); trigger.click(); });
    await settle();
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(dialog.querySelector('[aria-current="page"]')?.textContent).toBe("TV Series");

    const first = dialog.querySelector<HTMLAnchorElement>("a")!;
    const last = dialog.querySelector<HTMLButtonElement>("button")!;
    await act(() => {
      first.focus();
      first.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }));
    });
    expect(document.activeElement).toBe(last);
    await act(() => last.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(first);

    await act(() => first.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    await settle();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  } finally {
    await act(() => root.unmount());
    container.remove();
  }
});
