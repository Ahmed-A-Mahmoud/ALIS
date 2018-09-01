import { SharingService } from './../../services/Sharing-Service/SharingService.service';
import { Component, NgZone, ViewChild } from '@angular/core';
import { NavController, Platform, Content } from 'ionic-angular';
import { AngularFireDatabase } from '../../../node_modules/angularfire2/database';
import { Contacts } from '@ionic-native/contacts';
import * as APIModule from 'apiai';

@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage {
  @ViewChild(Content) content: Content;
  chats = []; //User Message
  answers = []; //ALIS Reply
  CurrentTime = []; //Message's Sent Time
  showImage = []; //array indicating there is a message or no
  DisplayImage = []; //array containing the images
  tutorsData = [];
  Tutors = [];
  Token = '';
  question: string;
  API_Agent: APIModule.Application;


  constructor(public navCtrl: NavController, public platform: Platform, public ngZone: NgZone, private afDatabase: AngularFireDatabase, private Share: SharingService, private contacts: Contacts) {
    platform.ready().then(() => {
      this.API_Agent = APIModule("7327b7cfa4a144a0b3924da4f9b375b9");
      this.Token = this.Share.getToken();
      console.log("Initializing...");
      //sign in by token
      this.Update_Time()
      this.afDatabase.database.ref('/users').once('value').then((snapshot1) => {
        if (snapshot1.child(this.Token).exists()) {
          this.API_Agent.eventRequest({ name: "Welcome", data: { 'Name': snapshot1.child(this.Token).child('First_name').val() } }, { sessionId: '0123456789' })
            .once('response', ({ result: { fulfillment: { speech } } }) => {
              speech = speech + "😊";
              this.answers.push(speech);
            }).once('error', (error) => {
              console.log(error);
            }).end();
        } else {
          this.API_Agent.eventRequest({ name: "Welcome" }, { sessionId: '0123456789' })
            .once('response', ({ result: { fulfillment: { speech } } }) => {
              speech = speech + "😊";
              this.answers.push(speech);
            }).once('error', (error) => {
              console.log(error);
            }).end();
        }
      });
    })
  }
  Update_Time() {
    var hours = new Date().getHours();
    var minutes = new Date().getMinutes();
    var ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    var minutesupdated = minutes < 10 ? '0' + minutes : minutes;
    var strTime = hours + ':' + minutesupdated + ' ' + ampm;
    this.CurrentTime.push(strTime);
  }

  SyncFriends() {
    this.contacts.find(['*'])
      .then(contactslist => {
        var numbers = []
        contactslist.forEach(data => {
          if (data.name) {
            if (data.name.formatted == undefined) {
              return
            }
          }
          else {
            return
          }

          if (data.phoneNumbers) {
            let phones = new Set<string>()
            var phone_as_name = false;
            data.phoneNumbers.some(phonenumber => {
              phonenumber.value = phonenumber.value.replace(/ +/g, "");
              if (data.name.formatted.trim() != phonenumber.value) {
                phones.add(phonenumber.value)
              }
              else {
                phone_as_name = true
                return true
              }
            })
            if (phone_as_name) {
              return
            }
            phones.forEach(phone => { numbers.push({ Phone: phone, Found: false }) })
          }
        })
        var friends = []
        this.afDatabase.database.ref('/users').once('value').then((snapshot1) => {
          if (snapshot1.exists()) {
            snapshot1.forEach((snapshot2) => {
              for (let index = 0; index < numbers.length; index++) {
                if (snapshot2.child('Phone').val() == numbers[index].Phone && numbers[index].Found == false) {
                  numbers[index].Found = true
                  friends.push(numbers[index].Phone)
                  let data = { Friends: friends };
                  this.addData('/users', this.Token, null, data).then().catch();
                  break
                }
              }
            })
          }
        });
      });
  }
  ask(question) {
    this.content.scrollToBottom();
    this.chats.push(this.question);
    this.Update_Time()
    this.content.scrollToBottom();

    this.API_Agent.textRequest(this.question, { sessionId: '0123456789' })
      .once('response', ({ result }) => {
        if (result.action == "SignIn.SignIn-custom") {
          this.afDatabase.database.ref('/users').once('value').then((snapshot1) => {
            if (snapshot1.exists()) {
              let phonefound = false
              snapshot1.forEach((snapshot2) => {
                if (snapshot2.child('Phone').val() == result.parameters['phone-number']) {
                  phonefound = true
                  if (snapshot2.child('Phone').ref.parent.key != this.Token) {
                    var child = snapshot2.child('Phone').ref.parent;
                    child.once('value').then((replace) => {
                      child.parent.child(this.Token).set(replace.val());
                      child.remove();
                    });
                  }
                  this.API_Agent.eventRequest({ name: "Welcome", data: { 'Name': snapshot2.child('First_name').val() } }, { sessionId: '0123456789' })
                    .once('response', ({ result: { fulfillment: { speech } } }) => {
                      speech = speech + "😊";
                      this.answers.push(speech);
                    }).once('error', (error) => {
                      console.log(error);
                    }).end();
                }
              })
              if (!phonefound) {
                this.answers.push("Sorry, I can't find your number. You can sign up again!😊");
              }
            } else {
              this.answers.push("I think you should sign up!😊");
            }
          })
        } else if (result.action == "SignUp-Name-Phone" && result.actionIncomplete == false) {
          this.afDatabase.database.ref('/users').once('value').then((snapshot1) => {
            if (snapshot1.exists()) {
              let phonefound = false
              snapshot1.forEach((snapshot2) => {
                if (snapshot2.child('Phone').val() == result.parameters['phone-number']) {
                  phonefound = true
                  return
                }
              })
              if (phonefound) {
                this.answers.push("This number is already used")
              }
              else {
                let data = { First_name: result.parameters["First-name"], Last_name: result.parameters["Last-name"], Phone: result.parameters["phone-number"] };
                this.addData('/users', this.Token, null, data).then().catch();
                this.answers.push(result.fulfillment.speech);
              }
            }
          })
        } else if (result.action == "Synchronize_Friends") {
          this.SyncFriends();
          this.answers.push(result.fulfillment.speech);
        }
        else if (result.action == "needTutor") {

          var teachers = [];
          var teacherDocsValues = ``;

          var paramSubject = result.parameters.tutorSubject;
          this.afDatabase.database.ref('/tutors').orderByChild('subject').equalTo(`${paramSubject.toLowerCase()}`)
            .on('value', (snapshot) => {

              snapshot.forEach((data) => {
                teachers.push(data.val());
              });

              this.tutorsData = teachers;
              console.log('teachers -->', this.tutorsData);

              var tutorsinfo = '';
              for (var i = 1; i <= this.tutorsData.length; i++) {
                console.log(this.tutorsData[i - 1].image);
                console.log(this.tutorsData[i - 1].name);
                console.log(this.tutorsData[i - 1].salary);
                console.log(this.tutorsData[i - 1].subject);

                this.Tutors.push(this.tutorsData[i - 1].name); //for tutors drop down options

                tutorsinfo += "Tutor Number " + i + " Name is " + this.tutorsData[i - 1].name + " of subject " + this.tutorsData[i - 1].subject + " for " + this.tutorsData[i - 1].salary + " L.E and image = " + this.tutorsData[i - 1].image + "\n \n";
              }
              console.log(tutorsinfo);
              this.answers.push(tutorsinfo);
            })
        }
        //CAREER GUIDANCE UPDATE 
        else if (result.action == "study_level") {

          if (result.parameters.study_level !== '') {
            let data = { studyLevel: result.parameters.study_level };
            this.addData('/users', this.Token, null, data).then().catch();
          }
          console.log(result);
          this.answers.push(result.fulfillment.speech);
        }

        else if (result.action == 'get_hobbies') {
          if (result.parameters.hobbies.length > 0) {
            let data = { hobbies: result.parameters.hobbies };
            this.addData('/users', this.Token, null, data).then().catch();
          }

          this.answers.push(result.fulfillment.speech);

          console.log(result);
        }
        else if (result.action == 'father_job') {
          if (result.parameters.father_job !== '') {
            let data = { fatherJob: result.parameters.fatherJob };
            this.addData('/users', this.Token, null, data).then().catch();
          }
          this.answers.push(result.fulfillment.speech);
        }
        else if (result.action == 'mother_job') {
          if (result.parameters.mother_job !== '') {
            let data = { motherJob: result.parameters.motherJob };
            this.addData('/users', this.Token, null, data).then().catch();
          }
          this.answers.push(result.fulfillment.speech);
        }
        else if (result.action == 'school_name') {
          if (result.parameters.school_name !== '') {
            let data = { schoolName: result.parameters.school_name };
            this.addData('/users', this.Token, null, data).then().catch();
          }
          this.answers.push(result.fulfillment.speech);
        }
        else if (result.action == 'getNational') {
          if (result.parameters.highSchoolDegree !== '') {
            let data = { highSchoolDegree: result.parameters.highSchoolDegree };
            this.addData('/users', this.Token, null, data).then().catch();
          }
          this.answers.push(result.fulfillment.speech);
        }
        else if (result.action == 'getSat') {
          if (result.parameters.highSchoolDegree !== '') {
            let data = { highSchoolDegree: result.parameters.highSchoolDegree };
            this.addData('/users', this.Token, null, data).then().catch();
          }
          this.answers.push(result.fulfillment.speech);
        }
        else if (result.action == 'getIG') {
          if (result.parameters.highSchoolDegree !== '') {
            let data = { highSchoolDegree: result.parameters.highSchoolDegree };
            this.addData('/users', this.Token, null, data).then().catch();
          }
          this.answers.push(result.fulfillment.speech);
        }
        else if (result.action == 'getTanyaThanawyGrade') {

          if (result.parameters.tanyaPercentage !== '') {
            var gradePercentage = result.parameters.tanyaPercentage;
            var gradeNum = gradePercentage.slice(0, -1);
          } else if (result.parameters.tanyaNum !== '') {
            var gradeNum = result.parameters.tanyaNum;
          }
          let data = { tanyaThanwyGrade: gradeNum };
          this.addData('/users', this.Token, 'thanawyGrades', data).then().catch();


          this.answers.push(result.fulfillment.speech);
        } else if (result.action == 'getTaltaThanawyGrade') {

          if (result.parameters.taltaPercentage !== '') {
            var gradePercentage = result.parameters.taltaPercentage;
            var gradeNum = gradePercentage.slice(0, -1);
          } else if (result.parameters.taltaNum !== '') {
            var gradeNum = result.parameters.taltaNum;
          }
          let data = { taltaThanwyGrade: gradeNum };
          this.addData('/users', this.Token, 'thanawyGrades', data).then().catch();

          this.answers.push(result.fulfillment.speech);
        }
        else if (result.action == 'getSat1') {

          if (result.parameters.sat1Percentage !== '') {
            var gradePercentage = result.parameters.sat1Percentage;
            var gradeNum = gradePercentage.slice(0, -1);
          }
          else if (result.parameters.sat1Num !== '') {
            var gradeNum = result.parameters.sat1Num;
          }
          // var satGrades = [];
          let data = { sat1Grade: gradeNum };
          this.addData('/users', this.Token, 'satGrades', data).then().catch();

          this.answers.push(result.fulfillment.speech);
        }
        else if (result.action == 'getSat2') {

          if (result.parameters.sat2Percentage !== '') {
            var gradePercentage = result.parameters.sat2Percentage;
            var gradeNum = gradePercentage.slice(0, -1);
          }
          else if (result.parameters.sat2Num !== '') {
            var gradeNum = result.parameters.sat2Num;
          }
          let data = { sat2Grade: gradeNum };
          this.addData('/users', this.Token, 'satGrades', data).then().catch();

          this.answers.push(result.fulfillment.speech);
        }
        else if (result.action == 'getIGArabicGrade') {
          if (result.parameters.arabicIG_Grade !== '') {
            let data = { arabicGrade: result.parameters.arabicIG_Grade };

            this.addData('/users', this.Token, 'IG_Grades', data).then().catch();
          }
          this.answers.push(result.fulfillment.speech);
        }
        else if (result.action == 'getIGEnglishGrade') {
          console.log(result);
          if (result.parameters.englishIG_Grade !== '') {
            let data = { englishGrade: result.parameters.englishIG_Grade };
            this.addData('/users', this.Token, 'IG_Grades', data).then().catch();
          }
          this.answers.push(result.fulfillment.speech);
        }
        else if (result.action == 'getIGMathGrade') {
          if (result.parameters.mathIG_Grade !== '') {
            let data = { mathGrade: result.parameters.mathIG_Grade };
            this.addData('/users', this.Token, 'IG_Grades', data).then().catch();
          }
          this.answers.push(result.fulfillment.speech);
        }
        else if (result.action == 'getIGChemistryGrade') {
          if (result.parameters.chemistryIG_Grade !== '') {
            let data = { chemistryGrade: result.parameters.chemistryIG_Grade };
            this.addData('/users', this.Token, 'IG_Grades', data).then().catch();
          }
          this.answers.push(result.fulfillment.speech);
        }
        else if (result.action == 'getIGPhysicsGrade') {
          if (result.parameters.physicsIG_Grade !== '') {
            let data = { chemistryGrade: result.parameters.physicsIG_Grade };
            this.addData('/users', this.Token, 'IG_Grades', data).then().catch();
          }
          this.answers.push(result.fulfillment.speech);
        }
        else if (result.action == 'getIGBiologyGrade') {
          if (result.parameters.biologyIG_Grade !== '') {
            let data = { chemistryGrade: result.parameters.biologyIG_Grade };
            this.addData('/users', this.Token, 'IG_Grades', data).then().catch();
          }
          this.answers.push(result.fulfillment.speech);
        }
        else {
          console.log(result.fulfillment.speech);
          this.answers.push(result.fulfillment.speech);
        }
      }).once('error', (error) => {
        console.log(error);
      }).end();

    this.question = null;
  }

  addData(collection, child, nextChild, data) {
    if (nextChild) {
      return this.afDatabase.database.ref(collection).child(child).child(nextChild).update(data);
    }
    return this.afDatabase.database.ref(collection).child(child).update(data);
  }
}
