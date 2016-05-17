# SwitchPortals
This script allows you to route jobs within Switch, without a direct connector. You can use this to better structure flows for readability, prevent crossing connectors and duplicate logic, and easily pass jobs between flows.

This repo contains two scripts: an incoming and an outgoing portal. You simply set up a common non-automanaged folder (called Ether) which all of your portals use. You don't have to set up an Ether for every flow -- it is global. Portals are multiplexed by channels (which you select in the script) so you can have multiple sets of portals within a single flow. 

<img src="https://i.imgur.com/4eFxxom.png">

## Usage

Route jobs through incoming portals. If they share the same scope:channel combination, they will process out of like outgoing portals. Use these to better organize individual flows or allow multiple flows to work together, without having to manage a bunch of non-automanaged folders. When passing jobs between flows, if metadata is needed, currently you have to pack and unpack before and after the respective portals.

### Flow element properties

#### Ether Path
A single non-automanaged path for the portals to work in. All of your portals can share the same Ether. 

#### Scope
This property namespaces your channels, allowing you to restrict or allow portals to work within or between flows.

#### Channel
This property multiplexes portals to allow several portals within your flow, or in other flows, to work without conflict. Incoming and outgoing portals which share the same channel and scope will exchange jobs.

#### Debug Warnings
Optional flag to send debug messages to the log as warnings.

## Todo
- Pack and unpack jobs automatically to maintain the Switch job ticket between flows
- Allow multiple outgoing portals for a given channel
