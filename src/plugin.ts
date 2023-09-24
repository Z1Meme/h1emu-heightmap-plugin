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

    if(this.lastCheck + 500 > Date.now()) {
      // only calculate every .5 second
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

    // get second canvasX and Y, either +1 or minus 1 based on decimal

    console.log(canvasX)
    console.log(canvasY)

    const grayscaleValue = this.getGrayscaleValue(Math.round(canvasX), Math.round(canvasY)),
    //const grayscaleValue = this.getAdjustedGrayscaleValue(canvasX, canvasY),
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

  private OOB(point: number) {
    return point > 4096 || point < -4096
  }


  private OOBcanvas(point: number) {
    return point > 8192 || point < 0
  }

  private getGrayscaleValue(x: number, y: number) {
    const pixelColor = this.canvasCtx.getImageData(x, y, 1, 1).data;
    const grayscaleValue = (pixelColor[0] + pixelColor[1] + pixelColor[2]) / 3; // Calculate average
    return grayscaleValue;
  }

  private getAvgPoints(start: number, end: number, count: number): number[] {
    if (count <= 0) {
      throw new Error("Count must be greater than zero");
    }
  
    const step = (end - start) / (count + 1);
    const averagePoints: number[] = [];
  
    for (let i = 1; i <= count; i++) {
      const averagePoint = start + i * step;
      averagePoints.push(averagePoint);
    }
  
    return averagePoints;
  }

  private getDecimal(number: number): number {
    const absNumber = Math.abs(number);
    const decimalDigit = Math.floor((absNumber * 10) % 10);
    return decimalDigit;
  }

  private getAdjustedGrayscaleValue(x: number, y: number) {
    const x1 = Math.floor(x),
    x2 = Math.ceil(x),
    y1 = Math.floor(y),
    y2 = Math.ceil(y);

    console.log(`x1 ${x1} x2 ${x2} y1 ${y1} y2 ${y2} `);

    if(this.OOBcanvas(x1) || this.OOBcanvas(x2) || this.OOBcanvas(y1) || this.OOBcanvas(y2)) {
      return 0;
    }

    // this is fucked somewhere idk

    const gray1 = this.getGrayscaleValue(x1, y1),
    gray2 = this.getGrayscaleValue(x2, y2);

    console.log(`gray1 ${gray1} gray2 ${gray2}`);

    const avg = this.getAvgPoints(gray1, gray2, 10);

    console.log(`avg ${avg}`);

    const xDec = this.getDecimal(x),
    yDec = this.getDecimal(y),
    decAvg = (xDec + yDec) / 2;

    return avg[decAvg];

    

    /*
    const xAvg = this.getAvgPoints(x1, x2, 10),
    yAvg = this.getAvgPoints(y1, y2, 10);
    */



    //return



  }

}