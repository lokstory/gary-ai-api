import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    super({
      clientID: configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.getOrThrow<string>('GOOGLE_CALLBACK_URL'),
      // scope: ['email', 'profile'],
      scope: ['openid', 'email', 'profile'],
      passReqToCallback: true,
    });
  }

  // validate(
  //   accessToken: string,
  //   refreshToken: string,
  //   profile: {
  //     id: string;
  //     emails?: { value: string; verified: boolean }[];
  //     displayName: string;
  //   },
  //   done: VerifyCallback,
  // ) {
  //   console.log(`accessToken:\n${accessToken}`);
  //   console.log(`_refreshToken:\n${refreshToken}`);
  //   const { id, emails } = profile;
  //   const email = emails?.[0]?.value ?? null;
  //   const emailVerified = emails?.[0]?.verified ?? false;
  //   done(null, { googleId: id, email, emailVerified });
  // }

  validate(
    req: Request,
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ) {
    console.log(req);
    console.log(accessToken);
    console.log(refreshToken);

    const idToken = req.body;

    console.log('id_token:', idToken);
    console.log('profile', profile);

    done(null, {
      email: profile.emails?.[0]?.value,
      googleId: profile.id,
      idToken,
    });
  }
}
