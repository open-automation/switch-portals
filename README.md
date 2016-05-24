# SwitchPortals
This script allows you to route jobs within Switch, without a direct connector. You can use this to better structure flows for readability, prevent crossing connectors and duplicate logic, and easily pass jobs between flows.

This repo contains two scripts: an incoming and an outgoing portal. Portals are multiplexed by channels (which you select in the script) so you can have multiple sets of portals within a single flow. 

<img src="https://i.imgur.com/4eFxxom.png">

## Usage

Route jobs through incoming portals. If they share the same scope:channel combination, they will process out of like outgoing portals. Use these to better organize individual flows or allow multiple flows to work together, without having to manage a bunch of non-automanaged folders. 

### Flow element properties

#### Scope
This property namespaces your channels, allowing you to restrict or allow portals to work within or between flows.

#### Channel
This property multiplexes portals to allow several portals within your flow, or in other flows, to work without conflict. Incoming and outgoing portals which share the same channel and scope will exchange jobs.

#### Debug Warnings
Optional flag to send debug messages to the log as warnings.

## Todo
- Allow multiple outgoing portals for a given channel
