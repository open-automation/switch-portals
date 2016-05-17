# SwitchPortals
This script allows you to route jobs within Switch, without a direct connector. You can use this to better structure flows for readability, prevent crossing connectors and duplicate logic, and easily pass jobs between flows.

This repo contains two scripts: an incoming and an outgoing portal. You simply set up a common non-automanaged folder (called Ether) which all of your portals use. You don't have to set up an Ether for every flow -- it is global. Portals are multiplexed by channels (which you select in the script) so you can have multiple sets of portals within a single flow. 

<img src="https://i.imgur.com/4eFxxom.png">

## Todo
- Pack and unpack jobs automatically to maintain the Switch job ticket between flows
- Allow multiple outgoing portals for a given channel
