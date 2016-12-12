# switch-portals
This script allows you to route jobs within Switch, without a direct connector. You can use this to better structure flows for readability, prevent crossing connectors and duplicate logic, and easily pass jobs between flows. Portals also makes sharing bundled flows much easier, as you don't need to re-locate non-automanaged folders every time you import a flow on a new system.

This repo contains two scripts: an incoming and an outgoing portal. Portals are multiplexed by channels (which you select in the script) so you can have multiple sets of portals within a single flow.

<img src="https://i.imgur.com/8gqHhVH.png" width="700">

## Usage

Route jobs through incoming portals. If they share the same scope:channel combination, they will process out of like outgoing portals. Use these to better organize individual flows or allow multiple flows to work together, without having to manage a bunch of non-automanaged folders. 

### Limitations
You can have multiple incoming (orange) portals for any scope:channel, but only one outgoing (blue) portal for that scope:channel. The reason why is, the orange portals pack and store the job away (in a location unknown to you) and the blue portal looks in that location. So, if you have multiple blue portals, then one of them would find the packed job and remove it before the other one could see it. Said another way, if you have multiple blue portals for any given scope:channel, then you can't be sure which blue portal the job will be routed to, so that behavior is not currently supported. A simpler solution is to use another channel for the second blue output.

In the diagram below, A and B represent matching scope:channel combinations.

<img src="https://i.imgur.com/mhs9Hc2.png" width="500">

### Flow element properties

#### Scope
This property namespaces your channels, allowing you to restrict or allow portals to work within or between flows.

- Flow - Within a particular flow
- Program - Anywhere with a shared Program ID on the Switch system
- Global - Anywhere on the Switch system

#### Channel
This property multiplexes portals to allow several portals within your flow, or in other flows, to work without conflict. Incoming and outgoing portals which share the same channel and scope will exchange jobs.

#### Debug verbose
Optional flag to send verbose debug messages to the log. Make sure log debugging is on: _Preferences > Logging > Log debug messages = Yes_.

## Callbacks
Read about callbacks in [switch-best-practices](https://github.com/open-automation/switch-best-practices#design-patterns) or the below presentations.

### '16 Enfocus Safari Presentation 
[Watch Recording](https://www.enfocus.com/en/virtual-safari/thinking-with-portals) | [Slides](https://docs.google.com/presentation/d/1bV9UrtWUQUcIyCZW-Su-C6SrRKYnkrHehvc10u77C-8/edit?usp=sharing)

## App
Portals is also available in the [Enfocus appstore](https://appstore.enfocus.com/product/Portals) as a free app.

## Versions
* **Version 1** - (_depreciated_) Used JSON for job ticket. Incompatible with all other versions.
* **Version 2** - (_stable_) Used XML for job ticket. Incompatible with version 1.
* **Version 3** - (_stable_) Improved performance and error handling. Compatible with version 2.


## Todo
- Allow multiple outgoing portals for a given channel
