defmodule BinaryWsWeb.PageController do
  use BinaryWsWeb, :controller

  def index(conn, _params) do
    render(conn, "index.html")
  end
end
