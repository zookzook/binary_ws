# This file is responsible for configuring your application
# and its dependencies with the aid of the Mix.Config module.
#
# This configuration file is loaded before any dependency and
# is restricted to this project.

# General application configuration
use Mix.Config

# Configures the endpoint
config :binary_ws, BinaryWsWeb.Endpoint,
  url: [host: "localhost"],
  secret_key_base: "Ax5C1iagWtDH/YczmYHnfkVbLr18NZq7f4WiIQdeC+vhd/2Zi0d/o9CnvJFsG+xs",
  render_errors: [view: BinaryWsWeb.ErrorView, accepts: ~w(html json)],
  pubsub: [name: BinaryWs.PubSub, adapter: Phoenix.PubSub.PG2],
  live_view: [signing_salt: "l4oRwQhW"]

# Configures Elixir's Logger
config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

# Use Jason for JSON parsing in Phoenix
config :phoenix, :json_library, Jason

config :binary_ws, BinaryWsWeb.Endpoint,
       live_view: [
         signing_salt: "HejsMEHZZgn/8OxMIqB51DS2pYkX/m04"
       ]

# Import environment specific config. This must remain at the bottom
# of this file so it overrides the configuration defined above.
import_config "#{Mix.env()}.exs"
