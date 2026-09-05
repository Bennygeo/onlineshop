import { GeoLoc } from "../utils/types";

declare var google: any;

export class GeoLocation {

    public static NOT_STARTED: string = "gps_not_started";
    public static ACCESS_GRANTED: string = "gps_access_granted";
    public static FAILED: string = "gps_failed";
    public static PLEASE_ENABLE_LOCATION = "please_enable_location";
    public static LOCATION_PROMPT = "gps_location_prompt";

    geoStatus: string = GeoLocation.NOT_STARTED
    geoLocation: GeoLoc;
    public static GPS_DENIED: string;

    //Geo status set and get
    public set status(status: string) {
        this.geoStatus = status;
    }

    public get status(): string {
        return this.geoStatus;
    }

    //location set and get
    public set location(vals: GeoLoc) {
        this.geoLocation = vals;
    }

    public get location(): GeoLoc {
        return this.geoLocation;
    }

    public getLocation(callback) {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position: any) => {
                if (position) {
                    this.status = GeoLocation.ACCESS_GRANTED;
                    this.geoLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    callback(this.status);
                }
            }, (error) => {
                this.status = GeoLocation.GPS_DENIED;
                callback(this.status);
            });
        } else {
            alert("Geolocation is not supported by this browser.");
        }
    }
}

