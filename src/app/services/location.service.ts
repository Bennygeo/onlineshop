import { Inject, Injectable } from '@angular/core';
import { User } from '../modals/user';
import { GeoLocation } from '../modals/geo-location';

@Injectable({
  providedIn: 'root'
})
export class LocationService {

  constructor(private user: User, @Inject('Window') private windowRef: Window) { }

  detect_my_location(): Promise<any> {
    return new Promise<any>((resolve, reject) => {

      this.user.GPSInfo.getLocation(async (status) => {

        if (this.user.GPSInfo.geoStatus == GeoLocation.ACCESS_GRANTED) {

          if (this.user.GPSInfo.geoLocation.lat == null) {
            resolve(GeoLocation.NOT_STARTED);
            return;
          }

          const lat = this.user.GPSInfo.geoLocation.lat;
          const lng = this.user.GPSInfo.geoLocation.lng;

          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
              {
                headers: {
                  'User-Agent': 'ThinkspotApp/1.0'
                }
              }
            );
            const data = await response.json();

            if (data && data.address) {
              this.user.pincode = data.address.postcode || '';
              resolve({ 'pincode': this.user.pincode, 'address': data.display_name });
            } else {
              resolve(GeoLocation.NOT_STARTED);
            }
          } catch (err) {
            console.error('Nominatim reverse geocoding error:', err);
            resolve(GeoLocation.FAILED);
          }
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

