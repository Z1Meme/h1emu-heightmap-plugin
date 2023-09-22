import { BasePlugin } from "@h1z1-server/out/servers/ZoneServer2016/managers/pluginmanager.js";
import { ZoneServer2016} from "@h1z1-server/out/servers/ZoneServer2016/zoneserver.js";
import { ZoneClient2016 as Client } from "@h1z1-server/out/servers/ZoneServer2016/classes/zoneclient";
import { CanvasRenderingContext2D, createCanvas, loadImage } from 'canvas';
import { isPosInRadius } from "@h1z1-server/out/utils/utils";

export default class ServerPlugin extends BasePlugin {
  public name = "Heightmap";
  public description = "Dev heightmap plugin";
  public author = "Meme";
  public version = "0.1";
  public commands = [
    /*
    {
      name: "testcommand",
      description: "This is an example of how to add a custom command.",
      permissionLevel: PermissionLevels.ADMIN, // determines what permission level a user needs to use this command
      execute: (server: ZoneServer2016, client: Client, args: Array<string>) => {
        // the code to executed when a command is trigged by an authorized user
        server.sendAlert(client, "Executed test command!");
      }
    },
    */
  ]

  private canvasCtx!: CanvasRenderingContext2D;

  private lastCheck = Date.now();

  /**
   * This method is called by PluginManager, do NOT call this manually
   * Use this method to set any plugin properties from the values in your config.yaml
  */ 
  public loadConfig(config: any) {
  }
  
  public async init(server: ZoneServer2016): Promise<void> {
    console.log("[Heightmap] Loading canvas data...")
    this.canvasCtx = await this.getCanvasCtx();
    console.log("[Heightmap] Canvas data loaded!")

    // an example of how to override the default behavior of any method outside of the ZoneServer2016 class (_packetHandlers in this example)
    server.pluginManager.hookMethod(this, server._packetHandlers, "PlayerUpdateUpdatePositionClientToZone", (server: ZoneServer2016, client: Client, packet: any)=> {
      if (packet.data.position) {
        this.printHeightmap(server, client, packet);
      }
    }, {callBefore: false, callAfter: true})
  }

  private async printHeightmap(server: ZoneServer2016, client: Client, packet: any) {
    const pos: Float32Array = new Float32Array([
      packet.data.position[0],
      packet.data.position[1],
      packet.data.position[2],
      0
    ]);

    if(this.lastCheck + 1000 > Date.now()) {
      // only calculate every second
      return;
    }

    if(this.OOB(pos[0]) || this.OOB(pos[2])) {
      console.log('Out of bounds');
      return;
    }

    this.lastCheck = Date.now();

    const {canvasX, canvasY} = this.ingameToCanvasPoint(pos);

    // TODO:
    /*
      - use the average between 2 points grayscale value
      ex:
        player is at x 1555.5, y 1400.5, so use average of gray values at x 1555, 1556 and y 1400, 1401

    */

    const grayscaleValue = this.getGrayscaleValue(canvasX, canvasY),
    adjusted = grayscaleValue * 2 + .8,
    y = pos[1];

    const msg = `raw: ${grayscaleValue} adj: ${grayscaleValue * 2 + 1} y: ${y.toFixed(1)} ${adjusted < y ? "[Too low!]" : ""}`
    console.log(msg);
    server.sendChatText(client, msg);

    server.constructionManager.placeTemporaryEntity(server, 1, new Float32Array([pos[0], adjusted, pos[2]]), new Float32Array([0, 0, 0, 0]), 30000)
  }

  private async getCanvasCtx(): Promise<CanvasRenderingContext2D> {
    const image = await loadImage(`${__dirname}\\..\\heightmap.png`),
    canvas = createCanvas(image.width, image.height),
    ctx = canvas.getContext('2d');

    ctx.drawImage(image, 0, 0);

    return ctx;
  }

  private ingameToCanvasPoint(point: Float32Array) {
    const x = point[0],
    y = point[2];

    return {
      canvasX: y + 4096,
      canvasY: -(x - 4096)
    }
  }

  private getGrayscaleValue(x: number, y: number) {
    const pixelColor = this.canvasCtx.getImageData(x, y, 1, 1).data;
    const grayscaleValue = (pixelColor[0] + pixelColor[1] + pixelColor[2]) / 3; // Calculate average
    return grayscaleValue;
  }

  private OOB(point: number) {
    return point > 4096 || point < -4096
  }

}