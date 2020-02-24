defmodule BinaryWsWeb.CounterLive do
  use Phoenix.LiveView
  alias Phoenix.LiveView.Socket

  def mount(_params, _session, socket) do
    {:ok, assign(socket, counter: 0)}
  end

  def render(assigns) do
    Phoenix.View.render(BinaryWsWeb.PageView, "index.html", assigns)
  end

  def handle_event("inc", params, %Socket{assigns: %{counter: counter}} = socket) do
    socket = assign(socket, counter: counter + 1)
    {:noreply, socket}
  end
end