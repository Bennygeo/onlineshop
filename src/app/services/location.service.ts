import { Inject, Injectable } from '@angular/core';
import { User } from '../modals/user';
import { GeoLocation } from '../modals/geo-location';

declare var google: any;

@Injectable({
  providedIn: 'root'
})
export class LocationService {

  constructor(private user: User, @Inject('Window') private windowRef: Window) { }

  detect_my_location(): Promise<any> {
    return new Promise<any>((resolve, reject) => {

      this.user.GPSInfo.getLocation((status) => {

        if (this.user.GPSInfo.geoStatus == GeoLocation.ACCESS_GRANTED) {

          if (this.user.GPSInfo.geoLocation.lat == null) {
            resolve(GeoLocation.NOT_STARTED)
          }

          var google_map_pos = new google.maps.LatLng(this.user.GPSInfo.geoLocation.lat, this.user.GPSInfo.geoLocation.lng);
          var google_maps_geocoder = new google.maps.Geocoder();

          google_maps_geocoder.geocode(
            { location: google_map_pos },
            (results, status) => {
              if (status == "OK") {
                this.user.pincode = results[0].address_components[results[0].address_components.length - 1].long_name as string;
                resolve({ 'pincode': this.user.pincode, 'address': results[0].formatted_address });
              }
            }
          );
        } else if (this.user.GPSInfo.geoStatus == "DENIED") {
          // this.detect_loc_loader_flg = false;
          if (this.windowRef["Android"]) {
            //send to Android
            this.windowRef["Android"].get_gps_location_from_andoid();
          } else if (this.windowRef['webkit']) {
            this.windowRef["webkit"].notify_ios_for_location();
          } else {
            resolve(GeoLocation.PLEASE_ENABLE_LOCATION);
          }
        } else if (this.user.GPSInfo.geoStatus == "PROMPT") {
          resolve(GeoLocation.LOCATION_PROMPT);
        } else if (this.user.GPSInfo.geoStatus == "NOT_STARTED" || this.user.GPSInfo.geoStatus == undefined) {
          resolve(GeoLocation.PLEASE_ENABLE_LOCATION);
        }
      });
    });
  }
}
